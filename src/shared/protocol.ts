export interface DatabaseInfo {
	path: string;
	name: string;
	detectedBy: 'auto-scan' | 'source-parse' | 'manual';
}

export interface TableInfo {
	schema: string;
	name: string;
	type: string;
}

export interface ColumnMeta {
	name: string;
	dataType: string;
	isNullable: boolean;
	defaultValue: string | null;
	isPrimaryKey: boolean;
	ordinalPosition: number;
}

export interface ConstraintInfo {
	name: string;
	type: 'PRIMARY KEY' | 'UNIQUE' | 'FOREIGN KEY' | 'CHECK';
	columns: string[];
	definition: string;
}

export interface IndexInfo {
	name: string;
	columns: string[];
	isUnique: boolean;
	definition: string;
}

export interface TableSchema {
	tableName: string;
	columns: ColumnMeta[];
	constraints: ConstraintInfo[];
	indexes: IndexInfo[];
}

// Extension -> Webview messages
export type ExtToWebviewMessage =
	| { type: 'databases'; databases: DatabaseInfo[] }
	| { type: 'tables'; tables: TableInfo[] }
	| {
		type: 'tableData';
		columns: ColumnMeta[];
		rows: Record<string, unknown>[];
		totalCount: number;
		page: number;
		pageSize: number;
	}
	| {
		type: 'queryResult';
		columns: ColumnMeta[];
		rows: Record<string, unknown>[];
		rowsAffected: number;
		error?: string;
		executionTimeMs: number;
	}
	| { type: 'schema'; schema: TableSchema }
	| { type: 'error'; message: string }
	| { type: 'rowInserted'; table: string }
	| { type: 'rowUpdated'; table: string }
	| { type: 'rowsDeleted'; table: string; count: number }
	| { type: 'selectDatabase'; dbPath: string; tableName?: string }
	| { type: 'databaseCreated'; dbPath: string }
	| { type: 'tableCreated'; tableName: string }
	| { type: 'tableAltered'; tableName: string }
	| { type: 'tableDropped'; tableName: string };

// Webview -> Extension messages
export type WebviewToExtMessage =
	| { type: 'listDatabases' }
	| { type: 'listTables'; dbPath: string }
	| {
		type: 'getTableData';
		dbPath: string;
		table: string;
		page: number;
		pageSize: number;
		orderBy?: string;
		orderDir?: 'ASC' | 'DESC';
		where?: string;
	}
	| { type: 'insertRow'; dbPath: string; table: string; row: Record<string, unknown> }
	| {
		type: 'updateRow';
		dbPath: string;
		table: string;
		pk: Record<string, unknown>;
		changes: Record<string, unknown>;
	}
	| { type: 'deleteRows'; dbPath: string; table: string; pks: Record<string, unknown>[] }
	| { type: 'executeQuery'; dbPath: string; sql: string }
	| { type: 'getSchema'; dbPath: string; table: string }
	| { type: 'exportData'; dbPath: string; table: string; format: 'csv' | 'json' }
	| { type: 'refreshDatabases' }
	| { type: 'createDatabase' }
	| { type: 'createTable'; dbPath: string; sql: string }
	| { type: 'alterTable'; dbPath: string; sql: string; tableName: string }
	| { type: 'dropTable'; dbPath: string; tableName: string };
