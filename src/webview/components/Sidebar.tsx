import React from 'react';
import { DatabaseInfo, TableInfo } from '../../shared/protocol';

interface SidebarProps {
	databases: DatabaseInfo[];
	tables: TableInfo[];
	selectedDb: string | null;
	selectedTable: string | null;
	onSelectDb: (dbPath: string) => void;
	onSelectTable: (tableName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
	databases,
	tables,
	selectedDb,
	selectedTable,
	onSelectDb,
	onSelectTable,
}) => {
	return (
		<div className="sidebar">
			<div className="sidebar-section">
				<label className="sidebar-label">Database</label>
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
					<label className="sidebar-label">Tables</label>
					<div className="table-list">
						{tables.length === 0 && (
							<div className="table-list-empty">No tables found</div>
						)}
						{tables.map((table) => (
							<button
								key={`${table.schema}.${table.name}`}
								className={`table-item ${
									selectedTable === table.name ? 'active' : ''
								}`}
								onClick={() => onSelectTable(table.name)}
								title={`${table.schema}.${table.name} (${table.type})`}
							>
								<span className="table-icon">⊞</span>
								{table.name}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};
