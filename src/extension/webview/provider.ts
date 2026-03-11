import * as vscode from 'vscode';
import { DatabaseDiscovery } from '../database/discovery';
import { ConnectionManager } from '../database/connection';
import { QueryService } from '../database/query';
import { WebviewToExtMessage } from '../../shared/protocol';
import { getConfig } from '../config';

export class ExplorerPanelProvider {
	private panel: vscode.WebviewPanel | undefined;
	private panelDisposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly discovery: DatabaseDiscovery,
		private readonly connectionManager: ConnectionManager,
		private readonly queryService: QueryService
	) {}

	open(dbPath?: string, tableName?: string): void {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
			if (dbPath) {
				this.panel.webview.postMessage({ type: 'selectDatabase', dbPath, tableName });
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

		this.panel.webview.html = this.getHtml(this.panel.webview, dbPath, tableName);

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
				case 'listDatabases':
				case 'refreshDatabases': {
					const databases = await this.discovery.discoverAll();
					this.panel?.webview.postMessage({ type: 'databases', databases });
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
						msg.where
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
					await this.queryService.insertRow(msg.dbPath, msg.table, msg.row);
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
						msg.changes
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
						msg.pks
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
					break;
				}
				case 'getSchema': {
					const schema = await this.queryService.getSchema(
						msg.dbPath,
						msg.table
					);
					this.panel?.webview.postMessage({ type: 'schema', schema });
					break;
				}
			case 'exportData': {
				const exportResult = await this.queryService.exportData(
					msg.dbPath,
					msg.table,
					msg.format
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
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			this.panel?.webview.postMessage({ type: 'error', message });
		}
	}

	private getHtml(webview: vscode.Webview, initialDb?: string, initialTable?: string): string {
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
