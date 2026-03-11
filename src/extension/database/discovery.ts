import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseInfo } from '../../shared/protocol';

export class DatabaseDiscovery implements vscode.Disposable {
	private readonly _onDidChange = new vscode.EventEmitter<DatabaseInfo[]>();
	readonly onDidChange = this._onDidChange.event;

	private databases: Map<string, DatabaseInfo> = new Map();
	private watchers: vscode.FileSystemWatcher[] = [];
	private disposed = false;

	async discoverAll(): Promise<DatabaseInfo[]> {
		this.databases.clear();

		const config = vscode.workspace.getConfiguration('pgliteExplorer');
		const promises: Promise<void>[] = [];

		if (config.get<boolean>('autoDetect', true)) {
			promises.push(this.autoScan());
		}
		if (config.get<boolean>('sourceDetect', true)) {
			promises.push(this.sourceParse());
		}

		this.loadManualPaths();
		await Promise.all(promises);

		const result = Array.from(this.databases.values());
		this._onDidChange.fire(result);
		return result;
	}

	startWatching(): void {
		const watcher = vscode.workspace.createFileSystemWatcher('**/PG_VERSION');
		watcher.onDidCreate(() => this.discoverAll());
		watcher.onDidDelete(() => this.discoverAll());
		this.watchers.push(watcher);
	}

	private async autoScan(): Promise<void> {
		const config = vscode.workspace.getConfiguration('pgliteExplorer');
		const excludePatterns = config.get<string[]>('excludePatterns', [
			'**/node_modules/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
		]);

		const excludeGlob = `{${excludePatterns.join(',')}}`;
		const files = await vscode.workspace.findFiles('**/PG_VERSION', excludeGlob, 100);

		for (const file of files) {
			const dbDir = path.dirname(file.fsPath);
			if (!this.databases.has(dbDir)) {
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
				const name = workspaceFolder
					? path.relative(workspaceFolder.uri.fsPath, dbDir)
					: path.basename(dbDir);
				this.databases.set(dbDir, {
					path: dbDir,
					name: name || path.basename(dbDir),
					detectedBy: 'auto-scan',
				});
			}
		}
	}

	private async sourceParse(): Promise<void> {
		const config = vscode.workspace.getConfiguration('pgliteExplorer');
		const excludePatterns = config.get<string[]>('excludePatterns', [
			'**/node_modules/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
		]);
		const excludeGlob = `{${excludePatterns.join(',')}}`;
		const files = await vscode.workspace.findFiles('**/*.{ts,js,mjs,mts}', excludeGlob, 200);

		for (const file of files) {
			try {
				const doc = await vscode.workspace.openTextDocument(file);
				const text = doc.getText();

				const pglitePattern = /(?:new\s+PGlite|PGlite\.create)\s*\(\s*['"`]([^'"`]+)['"`]/g;
				let match;
				while ((match = pglitePattern.exec(text)) !== null) {
					const dbPath = match[1];
					if (dbPath.startsWith('memory://') || dbPath.startsWith('idb://')) {
						continue;
					}

					let resolvedPath: string;
					if (path.isAbsolute(dbPath)) {
						resolvedPath = dbPath;
					} else if (dbPath.startsWith('file://')) {
						resolvedPath = dbPath.replace('file://', '');
					} else {
						resolvedPath = path.resolve(path.dirname(file.fsPath), dbPath);
					}

					if (!this.databases.has(resolvedPath) && fs.existsSync(resolvedPath)) {
						const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
						const name = workspaceFolder
							? path.relative(workspaceFolder.uri.fsPath, resolvedPath)
							: path.basename(resolvedPath);
						this.databases.set(resolvedPath, {
							path: resolvedPath,
							name: name || path.basename(resolvedPath),
							detectedBy: 'source-parse',
						});
					}
				}
			} catch {
				// Skip files that can't be read
			}
		}
	}

	private loadManualPaths(): void {
		const config = vscode.workspace.getConfiguration('pgliteExplorer');
		const manualPaths = config.get<string[]>('databasePaths', []);

		for (const dbPath of manualPaths) {
			let resolvedPath = dbPath;
			if (!path.isAbsolute(dbPath) && vscode.workspace.workspaceFolders?.[0]) {
				resolvedPath = path.resolve(
					vscode.workspace.workspaceFolders[0].uri.fsPath,
					dbPath
				);
			}

			if (!this.databases.has(resolvedPath)) {
				this.databases.set(resolvedPath, {
					path: resolvedPath,
					name: path.basename(resolvedPath),
					detectedBy: 'manual',
				});
			}
		}
	}

	getDatabases(): DatabaseInfo[] {
		return Array.from(this.databases.values());
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this._onDidChange.dispose();
		for (const w of this.watchers) {
			w.dispose();
		}
		this.watchers = [];
	}
}
