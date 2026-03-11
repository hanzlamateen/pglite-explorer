import * as vscode from 'vscode';

export const CONFIG_SECTION = 'pgliteExplorer';

export interface ExtensionConfig {
	databasePaths: string[];
	autoDetect: boolean;
	sourceDetect: boolean;
	excludePatterns: string[];
	pageSize: number;
}

export function getConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return {
		databasePaths: config.get<string[]>('databasePaths', []),
		autoDetect: config.get<boolean>('autoDetect', true),
		sourceDetect: config.get<boolean>('sourceDetect', true),
		excludePatterns: config.get<string[]>('excludePatterns', [
			'**/node_modules/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
		]),
		pageSize: config.get<number>('pageSize', 50),
	};
}
