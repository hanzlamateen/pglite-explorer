import * as vscode from 'vscode';
import { DatabaseDiscovery } from './database/discovery';
import { ConnectionManager } from './database/connection';
import { QueryService } from './database/query';
import { ExplorerPanelProvider } from './webview/provider';
import { DatabaseTreeProvider } from './views/databaseTree';
import { registerCommands } from './commands';
import { CONFIG_SECTION } from './config';

let connectionManager: ConnectionManager;

export function activate(context: vscode.ExtensionContext): void {
	const discovery = new DatabaseDiscovery();
	connectionManager = new ConnectionManager();
	const queryService = new QueryService(connectionManager);
	const panelProvider = new ExplorerPanelProvider(
		context.extensionUri,
		discovery,
		connectionManager,
		queryService
	);

	const treeProvider = new DatabaseTreeProvider(discovery, queryService);
	const treeView = vscode.window.createTreeView('pgliteExplorerDatabases', {
		treeDataProvider: treeProvider,
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

	registerCommands(context, panelProvider, discovery, treeProvider);

	context.subscriptions.push(discovery);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(CONFIG_SECTION)) {
				discovery.discoverAll();
			}
		})
	);

	discovery.startWatching();
	discovery.discoverAll();
}

export async function deactivate(): Promise<void> {
	if (connectionManager) {
		await connectionManager.closeAll();
	}
}
