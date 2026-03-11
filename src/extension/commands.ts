import * as vscode from 'vscode';
import { ExplorerPanelProvider } from './webview/provider';
import { DatabaseDiscovery } from './database/discovery';
import { DatabaseTreeProvider } from './views/databaseTree';
import { CONFIG_SECTION } from './config';

export function registerCommands(
	context: vscode.ExtensionContext,
	panelProvider: ExplorerPanelProvider,
	discovery: DatabaseDiscovery,
	treeProvider: DatabaseTreeProvider
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.open', (dbPath?: string) => {
			panelProvider.open(dbPath);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.openTable', (dbPath: string, tableName: string) => {
			panelProvider.open(dbPath, tableName);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('pgliteExplorer.refresh', async () => {
			await discovery.discoverAll();
			treeProvider.refresh();
			vscode.window.showInformationMessage(
				`PGlite Explorer: Found ${discovery.getDatabases().length} database(s).`
			);
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
}
