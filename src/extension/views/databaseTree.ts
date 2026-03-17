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
			return this.getSchemasForDb(element.dbInfo);
		}

		if (element instanceof SchemaItem) {
			return element.tables.map((t) => new TableItem(t, element.db));
		}

		return [];
	}

	private async getSchemasForDb(db: DatabaseInfo): Promise<TreeItem[]> {
		let tables: TableInfo[];

		const cached = this.tableCache.get(db.path);
		if (cached) {
			tables = cached;
		} else {
			try {
				tables = await this.queryService.listTables(db.path);
				this.tableCache.set(db.path, tables);
			} catch {
				return [new ErrorItem('Failed to load tables')];
			}
		}

		const bySchema = new Map<string, TableInfo[]>();
		for (const t of tables) {
			const group = bySchema.get(t.schema) ?? [];
			group.push(t);
			bySchema.set(t.schema, group);
		}

		const schemas = Array.from(bySchema.entries());

		if (schemas.length === 1 && schemas[0][0] === 'public') {
			return schemas[0][1].map((t) => new TableItem(t, db));
		}

		return schemas.map(([schemaName, schemaTables]) =>
			new SchemaItem(schemaName, schemaTables, db)
		);
	}
}

type TreeItem = DatabaseItem | SchemaItem | TableItem | ErrorItem;

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

class SchemaItem extends vscode.TreeItem {
	constructor(
		public readonly schemaName: string,
		public readonly tables: TableInfo[],
		public readonly db: DatabaseInfo
	) {
		super(schemaName, vscode.TreeItemCollapsibleState.Expanded);

		this.tooltip = `Schema: ${schemaName} (${tables.length} table${tables.length !== 1 ? 's' : ''})`;
		this.description = `${tables.length} table${tables.length !== 1 ? 's' : ''}`;
		this.iconPath = new vscode.ThemeIcon('symbol-namespace');
		this.contextValue = 'schema';
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
			arguments: [db.path, tableInfo.name, tableInfo.schema],
		};
	}
}

class ErrorItem extends vscode.TreeItem {
	constructor(message: string) {
		super(message, vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon('warning');
	}
}
