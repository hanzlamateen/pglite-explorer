import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseDiscovery } from '../database/discovery';
import { ConnectionManager } from '../database/connection';
import { QueryService } from '../database/query';
import { DatabaseTreeProvider } from '../views/databaseTree';
import { WebviewToExtMessage } from '../../shared/protocol';
import { getConfig, CONFIG_SECTION } from '../config';

export class ExplorerPanelProvider {
	private panel: vscode.WebviewPanel | undefined;
	private panelDisposables: vscode.Disposable[] = [];
	private treeProvider: DatabaseTreeProvider | undefined;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly discovery: DatabaseDiscovery,
		private readonly connectionManager: ConnectionManager,
		private readonly queryService: QueryService
	) {}

	setTreeProvider(treeProvider: DatabaseTreeProvider): void {
		this.treeProvider = treeProvider;
	}

	private refreshTree(): void {
		this.treeProvider?.refresh();
	}

	open(dbPath?: string, tableName?: string, tableSchema?: string): void {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
			if (dbPath) {
				this.panel.webview.postMessage({ type: 'selectDatabase', dbPath, tableName, tableSchema });
			}
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'pgliteExplorer',
			'PGlite Explorer',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(this.extensionUri, 'dist-webview'),
				],
			}
		);

		this.panel.webview.html = this.getHtml(this.panel.webview, dbPath, tableName, tableSchema);

		this.panelDisposables.push(
			this.panel.webview.onDidReceiveMessage(
				(msg: WebviewToExtMessage) => this.handleMessage(msg)
			)
		);

		this.panelDisposables.push(
			this.discovery.onDidChange((databases) => {
				this.panel?.webview.postMessage({ type: 'databases', databases });
			})
		);

		this.panel.onDidDispose(() => {
			for (const d of this.panelDisposables) {
				d.dispose();
			}
			this.panelDisposables = [];
			this.panel = undefined;
		});
	}

	private async handleMessage(msg: WebviewToExtMessage): Promise<void> {
		try {
			switch (msg.type) {
				case 'listDatabases': {
					const databases = await this.discovery.discoverAll();
					this.panel?.webview.postMessage({ type: 'databases', databases });
					break;
				}
				case 'refreshDatabases': {
					await this.connectionManager.reconnectAll();
					const databases = await this.discovery.discoverAll();
					this.panel?.webview.postMessage({ type: 'databases', databases });
					this.refreshTree();
					break;
				}
				case 'refreshTables': {
					await this.connectionManager.reconnect(msg.dbPath);
					const tables = await this.queryService.listTables(msg.dbPath);
					this.panel?.webview.postMessage({ type: 'tables', tables });
					this.refreshTree();
					break;
				}
				case 'listTables': {
					const tables = await this.queryService.listTables(msg.dbPath);
					this.panel?.webview.postMessage({ type: 'tables', tables });
					break;
				}
				case 'getTableData': {
					const data = await this.queryService.getTableData(
						msg.dbPath,
						msg.table,
						msg.page,
						msg.pageSize,
						msg.orderBy,
						msg.orderDir,
						msg.where,
						msg.schema
					);
					this.panel?.webview.postMessage({
						type: 'tableData',
						...data,
						page: msg.page,
						pageSize: msg.pageSize,
					});
					break;
				}
				case 'insertRow': {
					await this.queryService.insertRow(msg.dbPath, msg.table, msg.row, msg.schema);
					this.panel?.webview.postMessage({
						type: 'rowInserted',
						table: msg.table,
					});
					break;
				}
				case 'updateRow': {
					await this.queryService.updateRow(
						msg.dbPath,
						msg.table,
						msg.pk,
						msg.changes,
						msg.schema
					);
					this.panel?.webview.postMessage({
						type: 'rowUpdated',
						table: msg.table,
					});
					break;
				}
				case 'deleteRows': {
					const count = await this.queryService.deleteRows(
						msg.dbPath,
						msg.table,
						msg.pks,
						msg.schema
					);
					this.panel?.webview.postMessage({
						type: 'rowsDeleted',
						table: msg.table,
						count,
					});
					break;
				}
				case 'executeQuery': {
					const result = await this.queryService.executeQuery(
						msg.dbPath,
						msg.sql
					);
					this.panel?.webview.postMessage({
						type: 'queryResult',
						...result,
					});
					if (!result.columns.length || this.looksLikeDdl(msg.sql)) {
						this.refreshTree();
					}
					break;
				}
				case 'getSchema': {
					const schema = await this.queryService.getSchema(
						msg.dbPath,
						msg.table,
						msg.schema
					);
					this.panel?.webview.postMessage({ type: 'schema', schema });
					break;
				}
		case 'exportData': {
			const exportResult = await this.queryService.exportData(
				msg.dbPath,
				msg.table,
				msg.format,
				msg.schema
			);
			const filterLabel = msg.format === 'json' ? 'JSON' : 'CSV';
			const ext = msg.format === 'json' ? 'json' : 'csv';
			const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri;
			const defaultUri = workspaceDir
				? vscode.Uri.joinPath(workspaceDir, exportResult.fileName)
				: vscode.Uri.file(exportResult.fileName);
			const uri = await vscode.window.showSaveDialog({
				defaultUri,
				filters: { [filterLabel]: [ext] },
				title: `Export ${msg.table} as ${filterLabel}`,
			});
			if (uri) {
				await vscode.workspace.fs.writeFile(uri, Buffer.from(exportResult.data, 'utf-8'));
				vscode.window.showInformationMessage(`Exported ${msg.table} to ${uri.fsPath}`);
			}
			break;
		}
		case 'createDatabase': {
			await this.handleCreateDatabase();
			break;
		}
		case 'createTable': {
			await this.queryService.executeSqlStatements(msg.dbPath, msg.sql);
			const nameMatch = msg.sql.match(/CREATE\s+TABLE\s+"([^"]+)"/i)
				?? msg.sql.match(/CREATE\s+TABLE\s+(\S+)/i);
			const tableName = nameMatch?.[1] ?? '';
			this.panel?.webview.postMessage({ type: 'tableCreated', tableName });
			this.refreshTree();
			break;
		}
		case 'alterTable': {
			await this.queryService.executeSqlStatements(msg.dbPath, msg.sql);
			this.panel?.webview.postMessage({ type: 'tableAltered', tableName: msg.tableName });
			this.refreshTree();
			break;
		}
		case 'dropTable': {
			const confirm = await vscode.window.showWarningMessage(
				`Are you sure you want to drop table "${msg.tableName}"? This cannot be undone.`,
				{ modal: true },
				'Drop Table'
			);
			if (confirm === 'Drop Table') {
				const safeSchema = `"${(msg.schema ?? 'public').replace(/"/g, '""')}"`;
				const safeName = `"${msg.tableName.replace(/"/g, '""')}"`;
				await this.queryService.executeQuery(
					msg.dbPath,
					`DROP TABLE IF EXISTS ${safeSchema}.${safeName}`
				);
				this.panel?.webview.postMessage({ type: 'tableDropped', tableName: msg.tableName });
				this.refreshTree();
			}
			break;
		}
		}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			this.panel?.webview.postMessage({ type: 'error', message });
		}
	}

	private looksLikeDdl(sql: string): boolean {
		return /^\s*(CREATE|DROP|ALTER|TRUNCATE|RENAME)\b/im.test(sql);
	}

	async createDatabase(): Promise<void> {
		await this.handleCreateDatabase();
	}

	private async handleCreateDatabase(): Promise<void> {
		const folderResult = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Parent Folder for New Database',
		});
		if (!folderResult?.[0]) return;

		const dbName = await vscode.window.showInputBox({
			prompt: 'Enter a name for the new database',
			placeHolder: 'my-database',
			validateInput: (value) => {
				if (!value.trim()) return 'Database name is required';
				if (/[<>:"/\\|?*]/.test(value)) return 'Name contains invalid characters';
				return undefined;
			},
		});
		if (!dbName) return;

		const dbPath = path.join(folderResult[0].fsPath, dbName);
		await this.connectionManager.getConnection(dbPath);

		const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
		const paths = config.get<string[]>('databasePaths', []);
		if (!paths.includes(dbPath)) {
			paths.push(dbPath);
			await config.update('databasePaths', paths, vscode.ConfigurationTarget.Workspace);
		}

		await this.discovery.discoverAll();
		vscode.window.showInformationMessage(`PGlite Explorer: Created database at ${dbPath}`);
		this.panel?.webview.postMessage({ type: 'databaseCreated', dbPath });
	}

	private getHtml(webview: vscode.Webview, initialDb?: string, initialTable?: string, initialSchema?: string): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'dist-webview', 'webview.bundle.js')
		);
		const cssUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'dist-webview', 'webview.bundle.css')
		);

		const config = getConfig();
		const nonce = getNonce();

		const configPayload = {
			pageSize: config.pageSize,
			initialDb: initialDb ?? null,
			initialTable: initialTable ?? null,
			initialSchema: initialSchema ?? null,
		};

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
	<title>PGlite Explorer</title>
	<link rel="stylesheet" href="${cssUri}">
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}">
		window.__PGLITE_CONFIG__ = ${JSON.stringify(configPayload)};
	</script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
