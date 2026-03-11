import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
	DatabaseInfo,
	TableInfo,
	ColumnMeta,
	TableSchema,
	ExtToWebviewMessage,
} from '../shared/protocol';
import { useMessaging } from './hooks/useMessaging';
import { ViewTab } from './types';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { DataGrid } from './components/DataGrid';
import { AddRowDialog } from './components/AddRowDialog';
import { SqlEditor } from './components/SqlEditor';
import { SchemaViewer } from './components/SchemaViewer';

const PAGE_SIZE = window.__PGLITE_CONFIG__?.pageSize ?? 50;
const INITIAL_DB = window.__PGLITE_CONFIG__?.initialDb ?? null;
const INITIAL_TABLE = window.__PGLITE_CONFIG__?.initialTable ?? null;

export const App: React.FC = () => {
	const [activeTab, setActiveTab] = useState<ViewTab>('data');
	const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
	const [tables, setTables] = useState<TableInfo[]>([]);
	const [selectedDb, setSelectedDb] = useState<string | null>(INITIAL_DB);
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const pendingTable = useRef<string | null>(INITIAL_TABLE);

	const [columns, setColumns] = useState<ColumnMeta[]>([]);
	const [rows, setRows] = useState<Record<string, unknown>[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [orderBy, setOrderBy] = useState<string | undefined>();
	const [orderDir, setOrderDir] = useState<'ASC' | 'DESC'>('ASC');
	const [where, setWhere] = useState<string | undefined>();

	const [showAddRow, setShowAddRow] = useState(false);

	const [sqlResult, setSqlResult] = useState<{
		columns: ColumnMeta[];
		rows: Record<string, unknown>[];
		rowsAffected: number;
		error?: string;
		executionTimeMs: number;
	} | null>(null);
	const [isExecuting, setIsExecuting] = useState(false);

	const [schema, setSchema] = useState<TableSchema | null>(null);
	const [schemaLoading, setSchemaLoading] = useState(false);

	const [error, setError] = useState<string | null>(null);

	const latestState = useRef({ selectedDb, selectedTable, page, orderBy, orderDir, where, activeTab });
	latestState.current = { selectedDb, selectedTable, page, orderBy, orderDir, where, activeTab };

	const sendMessageRef = useRef<(msg: import('../shared/protocol').WebviewToExtMessage) => void>();

	const loadTableData = useCallback(
		(p: number) => {
			const { selectedDb: db, selectedTable: tbl, orderBy: ob, orderDir: od, where: w } = latestState.current;
			if (!db || !tbl) return;
			sendMessageRef.current?.({
				type: 'getTableData',
				dbPath: db,
				table: tbl,
				page: p,
				pageSize: PAGE_SIZE,
				orderBy: ob,
				orderDir: od,
				where: w,
			});
		},
		[]
	);

	const refreshTableData = useCallback(() => {
		loadTableData(latestState.current.page);
	}, [loadTableData]);

	const loadSchema = useCallback(() => {
		const { selectedDb: db, selectedTable: tbl } = latestState.current;
		if (!db || !tbl) return;
		setSchemaLoading(true);
		sendMessageRef.current?.({
			type: 'getSchema',
			dbPath: db,
			table: tbl,
		});
	}, []);

	const handleMessage = useCallback(
		(msg: ExtToWebviewMessage) => {
			switch (msg.type) {
				case 'databases':
					setDatabases(msg.databases);
					setSelectedDb((prev) => {
						if (prev) return prev;
						return msg.databases.length > 0 ? msg.databases[0].path : null;
					});
					break;
				case 'tables':
					setTables(msg.tables);
					if (pendingTable.current) {
						const match = msg.tables.find((t) => t.name === pendingTable.current);
						if (match) {
							setSelectedTable(match.name);
						}
						pendingTable.current = null;
					}
					break;
			case 'selectDatabase': {
				const isSameDb = latestState.current.selectedDb === msg.dbPath;
				if (isSameDb && msg.tableName) {
					setSelectedTable(msg.tableName);
				} else {
					setSelectedTable(null);
					setColumns([]);
					setRows([]);
					setTotalCount(0);
					if (msg.tableName) {
						pendingTable.current = msg.tableName;
					}
					setSelectedDb(msg.dbPath);
				}
				break;
			}
				case 'tableData':
					setColumns(msg.columns);
					setRows(msg.rows);
					setTotalCount(msg.totalCount);
					setPage(msg.page);
					break;
				case 'queryResult':
					setSqlResult(msg);
					setIsExecuting(false);
					break;
				case 'schema':
					setSchema(msg.schema);
					setSchemaLoading(false);
					break;
			case 'rowInserted':
				case 'rowUpdated':
				case 'rowsDeleted':
					refreshTableData();
					break;
				case 'error':
					setError(msg.message);
					setIsExecuting(false);
					setSchemaLoading(false);
					setTimeout(() => setError(null), 5000);
					break;
			}
		},
		[refreshTableData]
	);

	const sendMessage = useMessaging(handleMessage);
	sendMessageRef.current = sendMessage;

	useEffect(() => {
		sendMessage({ type: 'listDatabases' });
	}, [sendMessage]);

	useEffect(() => {
		if (selectedDb) {
			sendMessage({ type: 'listTables', dbPath: selectedDb });
			setSelectedTable(null);
			setTables([]);
		}
	}, [selectedDb, sendMessage]);

	useEffect(() => {
		if (selectedDb && selectedTable) {
			loadTableData(1);
			if (latestState.current.activeTab === 'schema') {
				loadSchema();
			}
		}
	}, [selectedDb, selectedTable, loadTableData, loadSchema]);

	useEffect(() => {
		if (activeTab === 'schema' && selectedDb && selectedTable) {
			loadSchema();
		}
	}, [activeTab, selectedDb, selectedTable, loadSchema]);

	const handleSort = useCallback(
		(col: string, dir: 'ASC' | 'DESC') => {
			setOrderBy(col);
			setOrderDir(dir);
			const { selectedDb: db, selectedTable: tbl, where: w } = latestState.current;
			if (db && tbl) {
				sendMessageRef.current?.({
					type: 'getTableData',
					dbPath: db,
					table: tbl,
					page: 1,
					pageSize: PAGE_SIZE,
					orderBy: col,
					orderDir: dir,
					where: w,
				});
			}
		},
		[]
	);

	const handleFilter = useCallback(
		(newWhere: string) => {
			setWhere(newWhere || undefined);
			const { selectedDb: db, selectedTable: tbl, orderBy: ob, orderDir: od } = latestState.current;
			if (db && tbl) {
				sendMessageRef.current?.({
					type: 'getTableData',
					dbPath: db,
					table: tbl,
					page: 1,
					pageSize: PAGE_SIZE,
					orderBy: ob,
					orderDir: od,
					where: newWhere || undefined,
				});
			}
		},
		[]
	);

	const handleUpdateRow = useCallback(
		(pk: Record<string, unknown>, changes: Record<string, unknown>) => {
			const { selectedDb: db, selectedTable: tbl } = latestState.current;
			if (!db || !tbl) return;
			sendMessageRef.current?.({
				type: 'updateRow',
				dbPath: db,
				table: tbl,
				pk,
				changes,
			});
		},
		[]
	);

	const handleDeleteRows = useCallback(
		(pks: Record<string, unknown>[]) => {
			const { selectedDb: db, selectedTable: tbl } = latestState.current;
			if (!db || !tbl) return;
			sendMessageRef.current?.({
				type: 'deleteRows',
				dbPath: db,
				table: tbl,
				pks,
			});
		},
		[]
	);

	const handleAddRow = useCallback(
		(row: Record<string, unknown>) => {
			const { selectedDb: db, selectedTable: tbl } = latestState.current;
			if (!db || !tbl) return;
			sendMessageRef.current?.({
				type: 'insertRow',
				dbPath: db,
				table: tbl,
				row,
			});
			setShowAddRow(false);
		},
		[]
	);

	const handleExecuteQuery = useCallback(
		(sqlText: string) => {
			const { selectedDb: db } = latestState.current;
			if (!db) return;
			setIsExecuting(true);
			setSqlResult(null);
			sendMessageRef.current?.({
				type: 'executeQuery',
				dbPath: db,
				sql: sqlText,
			});
		},
		[]
	);

	const handleExport = useCallback(
		(format: 'csv' | 'json') => {
			const { selectedDb: db, selectedTable: tbl } = latestState.current;
			if (!db || !tbl) return;
			sendMessageRef.current?.({
				type: 'exportData',
				dbPath: db,
				table: tbl,
				format,
			});
		},
		[]
	);

	const handleRefresh = useCallback(() => {
		sendMessageRef.current?.({ type: 'refreshDatabases' });
		const { selectedDb: db, selectedTable: tbl } = latestState.current;
		if (db && tbl) {
			refreshTableData();
		}
	}, [refreshTableData]);

	return (
		<div className="app">
			<Toolbar
				activeTab={activeTab}
				onTabChange={setActiveTab}
				onRefresh={handleRefresh}
				onExport={selectedTable ? handleExport : undefined}
				hasTable={!!selectedTable}
			/>
			<div className="app-body">
				<Sidebar
					databases={databases}
					tables={tables}
					selectedDb={selectedDb}
					selectedTable={selectedTable}
					onSelectDb={setSelectedDb}
					onSelectTable={setSelectedTable}
				/>
				<div className="main-content">
					{error && <div className="error-banner">{error}</div>}

					{!selectedDb && (
						<div className="empty-state">
							<h2>Welcome to PGlite Explorer</h2>
							<p>Select a database from the sidebar to get started.</p>
							<p>
								No databases detected? Use the command palette to add one
								manually.
							</p>
						</div>
					)}

					{selectedDb && !selectedTable && activeTab !== 'sql' && (
						<div className="empty-state">
							<p>Select a table from the sidebar to browse its data.</p>
						</div>
					)}

					{activeTab === 'data' && selectedTable && (
						<DataGrid
							columns={columns}
							rows={rows}
							totalCount={totalCount}
							page={page}
							pageSize={PAGE_SIZE}
							onPageChange={loadTableData}
							onSort={handleSort}
							onFilter={handleFilter}
							onUpdateRow={handleUpdateRow}
							onDeleteRows={handleDeleteRows}
							onAddRow={() => setShowAddRow(true)}
						/>
					)}

					{activeTab === 'sql' && selectedDb && (
						<SqlEditor
							onExecute={handleExecuteQuery}
							result={sqlResult}
							isExecuting={isExecuting}
						/>
					)}

					{activeTab === 'schema' && (
						<SchemaViewer schema={schema} loading={schemaLoading} />
					)}
				</div>
			</div>

			<div className="status-bar">
				<span>
					{selectedDb
						? `Connected to ${databases.find((d) => d.path === selectedDb)?.name ?? selectedDb}`
						: 'No database selected'}
				</span>
				<span>{tables.length} table(s)</span>
				{selectedTable && (
					<span>
						{selectedTable} ({totalCount} rows)
					</span>
				)}
			</div>

			{showAddRow && columns.length > 0 && (
				<AddRowDialog
					columns={columns}
					onSubmit={handleAddRow}
					onClose={() => setShowAddRow(false)}
				/>
			)}

			</div>
	);
};
