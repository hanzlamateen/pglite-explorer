import * as vscode from 'vscode';
import * as path from 'path';
import { ExplorerPanelProvider } from './webview/provider';
import { DatabaseDiscovery } from './database/discovery';
import { ConnectionManager } from './database/connection';
import { DatabaseTreeProvider } from './views/databaseTree';
import { CONFIG_SECTION } from './config';

export function registerCommands(
	context: vscode.ExtensionContext,
	panelProvider: ExplorerPanelProvider,
	discovery: DatabaseDiscovery,
	treeProvider: DatabaseTreeProvider,
	connectionManager: ConnectionManager
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.open', (dbPath?: string) => {
			panelProvider.open(dbPath);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.openTable', (dbPath: string, tableName: string, tableSchema?: string) => {
			panelProvider.open(dbPath, tableName, tableSchema);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.refresh', async () => {
			await connectionManager.reconnectAll();
			await discovery.discoverAll();
			treeProvider.refresh();
			vscode.window.showInformationMessage(
				`PGlite Explorer: Found ${discovery.getDatabases().length} database(s).`
			);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.createDatabase', async () => {
			await panelProvider.createDatabase();
			treeProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.addDatabase', async () => {
			const result = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select PGlite Database Directory',
			});

			if (result?.[0]) {
				const dbPath = result[0].fsPath;
				const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
				const paths = config.get<string[]>('databasePaths', []);

				if (!paths.includes(dbPath)) {
					paths.push(dbPath);
					await config.update('databasePaths', paths, vscode.ConfigurationTarget.Workspace);
					await discovery.discoverAll();
					treeProvider.refresh();
					vscode.window.showInformationMessage(
						`PGlite Explorer: Added database at ${dbPath}`
					);
				}
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.removeDatabase', async (item?: { dbInfo?: { path: string } }) => {
			const dbPath = item?.dbInfo?.path;
			if (!dbPath) return;

			const confirm = await vscode.window.showWarningMessage(
				`Remove "${dbPath}" from PGlite Explorer?`,
				{ modal: true, detail: 'This only removes the database from the explorer. The database files will not be deleted.' },
				'Remove'
			);

			if (confirm === 'Remove') {
				const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
				const paths = config.get<string[]>('databasePaths', []);
				const updated = paths.filter((p) => {
					const resolved = path.isAbsolute(p)
						? p
						: path.resolve(
							vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
							p
						);
					return resolved !== dbPath;
				});

				await config.update('databasePaths', updated, vscode.ConfigurationTarget.Workspace);
				await discovery.discoverAll();
				treeProvider.refresh();
				vscode.window.showInformationMessage(`PGlite Explorer: Removed database`);
			}
		})
	);
}
