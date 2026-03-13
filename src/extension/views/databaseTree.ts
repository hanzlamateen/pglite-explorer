import * as vscode from 'vscode';
import { DatabaseDiscovery } from '../database/discovery';
import { QueryService } from '../database/query';
import { DatabaseInfo, TableInfo } from '../../shared/protocol';

export class DatabaseTreeProvider implements vscode.TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private tableCache = new Map<string, TableInfo[]>();

	constructor(
		private readonly discovery: DatabaseDiscovery,
		private readonly queryService: QueryService
	) {
		discovery.onDidChange(() => {
			this.tableCache.clear();
			this._onDidChangeTreeData.fire();
		});
	}

	refresh(): void {
		this.tableCache.clear();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		if (!element) {
			const databases = this.discovery.getDatabases();
			return databases.map((db) => new DatabaseItem(db));
		}

		if (element instanceof DatabaseItem) {
			return this.getTablesForDb(element.dbInfo);
		}

		return [];
	}

	private async getTablesForDb(db: DatabaseInfo): Promise<TreeItem[]> {
		const cached = this.tableCache.get(db.path);
		if (cached) {
			return cached.map((t) => new TableItem(t, db));
		}

		try {
			const tables = await this.queryService.listTables(db.path);
			this.tableCache.set(db.path, tables);
			return tables.map((t) => new TableItem(t, db));
		} catch {
			return [new ErrorItem('Failed to load tables')];
		}
	}
}

type TreeItem = DatabaseItem | TableItem | ErrorItem;

class DatabaseItem extends vscode.TreeItem {
	constructor(public readonly dbInfo: DatabaseInfo) {
		super(dbInfo.name, vscode.TreeItemCollapsibleState.Collapsed);

		this.tooltip = `${dbInfo.path}\nDetected by: ${dbInfo.detectedBy}`;
		this.description = dbInfo.detectedBy;
		this.iconPath = new vscode.ThemeIcon('database');
		this.contextValue = dbInfo.detectedBy === 'manual' ? 'database-manual' : 'database';

		this.command = {
			command: 'pgliteExplorer.open',
			title: 'Open Explorer',
			arguments: [dbInfo.path],
		};
	}
}

class TableItem extends vscode.TreeItem {
	constructor(
		public readonly tableInfo: TableInfo,
		public readonly db: DatabaseInfo
	) {
		super(tableInfo.name, vscode.TreeItemCollapsibleState.None);

		this.tooltip = `${tableInfo.schema}.${tableInfo.name} (${tableInfo.type})`;
		this.description = tableInfo.type === 'BASE TABLE' ? '' : tableInfo.type;
		this.iconPath = new vscode.ThemeIcon(
			tableInfo.type === 'VIEW' ? 'eye' : 'layout'
		);
		this.contextValue = 'table';

		this.command = {
			command: 'pgliteExplorer.openTable',
			title: 'Open Table',
			arguments: [db.path, tableInfo.name],
		};
	}
}

class ErrorItem extends vscode.TreeItem {
	constructor(message: string) {
		super(message, vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon('warning');
	}
}
