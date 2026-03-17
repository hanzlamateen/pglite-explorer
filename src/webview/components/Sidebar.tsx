import React, { useMemo, useState } from 'react';
import { DatabaseInfo, TableInfo } from '../../shared/protocol';

interface SidebarProps {
	databases: DatabaseInfo[];
	tables: TableInfo[];
	selectedDb: string | null;
	selectedTable: string | null;
	selectedSchema: string | null;
	onSelectDb: (dbPath: string) => void;
	onSelectTable: (tableName: string, tableSchema: string) => void;
	onCreateDatabase: () => void;
	onCreateTable: () => void;
	onRefreshTables: () => void;
	onEditTable: (tableName: string, tableSchema?: string) => void;
	onDropTable: (tableName: string, tableSchema?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
	databases,
	tables,
	selectedDb,
	selectedTable,
	selectedSchema,
	onSelectDb,
	onSelectTable,
	onCreateDatabase,
	onCreateTable,
	onRefreshTables,
	onEditTable,
	onDropTable,
}) => {
	const schemaGroups = useMemo(() => {
		const grouped = new Map<string, TableInfo[]>();
		for (const t of tables) {
			const group = grouped.get(t.schema) ?? [];
			group.push(t);
			grouped.set(t.schema, group);
		}
		return Array.from(grouped.entries());
	}, [tables]);

	const hasMultipleSchemas = schemaGroups.length > 1;

	const [collapsedSchemas, setCollapsedSchemas] = useState<Set<string>>(new Set());

	const toggleSchema = (schemaName: string) => {
		setCollapsedSchemas((prev) => {
			const next = new Set(prev);
			if (next.has(schemaName)) {
				next.delete(schemaName);
			} else {
				next.add(schemaName);
			}
			return next;
		});
	};

	return (
		<div className="sidebar">
			<div className="sidebar-section">
				<div className="sidebar-label-row">
					<label className="sidebar-label">Database</label>
					<button
						className="btn-icon btn-sidebar-action"
						onClick={onCreateDatabase}
						title="Create new database"
					>
						+
					</button>
				</div>
				<select
					className="sidebar-select"
					value={selectedDb ?? ''}
					onChange={(e) => onSelectDb(e.target.value)}
				>
					<option value="" disabled>
						Select a database...
					</option>
					{databases.map((db) => (
						<option key={db.path} value={db.path}>
							{db.name}
						</option>
					))}
				</select>
			</div>

			{selectedDb && (
				<div className="sidebar-section">
					<div className="sidebar-label-row">
						<label className="sidebar-label">Tables</label>
						<div className="sidebar-actions">
							<button
								className="btn-icon btn-sidebar-action"
								onClick={onRefreshTables}
								title="Refresh tables"
							>
								↻
							</button>
							<button
								className="btn-icon btn-sidebar-action"
								onClick={onCreateTable}
								title="Create new table"
							>
								+
							</button>
						</div>
					</div>
					<div className="table-list">
						{tables.length === 0 && (
							<div className="table-list-empty">No tables found</div>
						)}

						{!hasMultipleSchemas && schemaGroups.length === 1 && (
							schemaGroups[0][1].map((table) => (
								<TableRow
									key={`${table.schema}.${table.name}`}
									table={table}
									isActive={selectedTable === table.name && selectedSchema === table.schema}
									onSelect={onSelectTable}
									onEdit={onEditTable}
									onDrop={onDropTable}
								/>
							))
						)}

						{hasMultipleSchemas && schemaGroups.map(([schemaName, schemaTables]) => (
							<SchemaGroup
								key={schemaName}
								schemaName={schemaName}
								tables={schemaTables}
								collapsed={collapsedSchemas.has(schemaName)}
								onToggle={() => toggleSchema(schemaName)}
								selectedTable={selectedTable}
								selectedSchema={selectedSchema}
								onSelectTable={onSelectTable}
								onEditTable={onEditTable}
								onDropTable={onDropTable}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

interface SchemaGroupProps {
	schemaName: string;
	tables: TableInfo[];
	collapsed: boolean;
	onToggle: () => void;
	selectedTable: string | null;
	selectedSchema: string | null;
	onSelectTable: (tableName: string, tableSchema: string) => void;
	onEditTable: (tableName: string, tableSchema?: string) => void;
	onDropTable: (tableName: string, tableSchema?: string) => void;
}

const SchemaGroup: React.FC<SchemaGroupProps> = ({
	schemaName,
	tables,
	collapsed,
	onToggle,
	selectedTable,
	selectedSchema,
	onSelectTable,
	onEditTable,
	onDropTable,
}) => (
	<div className="schema-group">
		<button
			className="schema-group-header"
			onClick={onToggle}
			title={`${schemaName} (${tables.length} table${tables.length !== 1 ? 's' : ''})`}
		>
			<span className={`schema-chevron ${collapsed ? '' : 'open'}`}>›</span>
			<span className="schema-group-icon">⬡</span>
			<span className="schema-group-name">{schemaName}</span>
			<span className="schema-group-count">{tables.length}</span>
		</button>
		{!collapsed && (
			<div className="schema-group-tables">
				{tables.map((table) => (
					<TableRow
						key={`${table.schema}.${table.name}`}
						table={table}
						isActive={selectedTable === table.name && selectedSchema === table.schema}
						onSelect={onSelectTable}
						onEdit={onEditTable}
						onDrop={onDropTable}
					/>
				))}
			</div>
		)}
	</div>
);

interface TableRowProps {
	table: TableInfo;
	isActive: boolean;
	onSelect: (tableName: string, tableSchema: string) => void;
	onEdit: (tableName: string, tableSchema?: string) => void;
	onDrop: (tableName: string, tableSchema?: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({
	table,
	isActive,
	onSelect,
	onEdit,
	onDrop,
}) => (
	<div
		className={`table-item ${isActive ? 'active' : ''}`}
	>
		<button
			className="table-item-btn"
			onClick={() => onSelect(table.name, table.schema)}
			title={`${table.schema}.${table.name} (${table.type})`}
		>
			<span className="table-icon">⊞</span>
			{table.name}
		</button>
		<div className="table-item-actions">
			<button
				className="btn-icon btn-table-action"
				onClick={(e) => { e.stopPropagation(); onEdit(table.name, table.schema); }}
				title="Edit table structure"
			>
				✎
			</button>
			<button
				className="btn-icon btn-table-action btn-danger-subtle"
				onClick={(e) => { e.stopPropagation(); onDrop(table.name, table.schema); }}
				title="Drop table"
			>
				✕
			</button>
		</div>
	</div>
);
