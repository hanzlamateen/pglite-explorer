import React from 'react';
import { DatabaseInfo, TableInfo } from '../../shared/protocol';

interface SidebarProps {
	databases: DatabaseInfo[];
	tables: TableInfo[];
	selectedDb: string | null;
	selectedTable: string | null;
	onSelectDb: (dbPath: string) => void;
	onSelectTable: (tableName: string) => void;
	onCreateDatabase: () => void;
	onCreateTable: () => void;
	onEditTable: (tableName: string) => void;
	onDropTable: (tableName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
	databases,
	tables,
	selectedDb,
	selectedTable,
	onSelectDb,
	onSelectTable,
	onCreateDatabase,
	onCreateTable,
	onEditTable,
	onDropTable,
}) => {
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
						<button
							className="btn-icon btn-sidebar-action"
							onClick={onCreateTable}
							title="Create new table"
						>
							+
						</button>
					</div>
					<div className="table-list">
						{tables.length === 0 && (
							<div className="table-list-empty">No tables found</div>
						)}
						{tables.map((table) => (
							<div
								key={`${table.schema}.${table.name}`}
								className={`table-item ${
									selectedTable === table.name ? 'active' : ''
								}`}
							>
								<button
									className="table-item-btn"
									onClick={() => onSelectTable(table.name)}
									title={`${table.schema}.${table.name} (${table.type})`}
								>
									<span className="table-icon">⊞</span>
									{table.name}
								</button>
								<div className="table-item-actions">
									<button
										className="btn-icon btn-table-action"
										onClick={(e) => { e.stopPropagation(); onEditTable(table.name); }}
										title="Edit table structure"
									>
										✎
									</button>
									<button
										className="btn-icon btn-table-action btn-danger-subtle"
										onClick={(e) => { e.stopPropagation(); onDropTable(table.name); }}
										title="Drop table"
									>
										✕
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};
