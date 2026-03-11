import React from 'react';
import { ColumnMeta } from '../../shared/protocol';

interface QueryResultsProps {
	columns: ColumnMeta[];
	rows: Record<string, unknown>[];
	rowsAffected: number;
	executionTimeMs: number;
	error?: string;
}

export const QueryResults: React.FC<QueryResultsProps> = ({
	columns,
	rows,
	rowsAffected,
	executionTimeMs,
	error,
}) => {
	if (error) {
		return <div className="sql-error">{error}</div>;
	}

	return (
		<div className="query-results">
			<div className="sql-results-info">
				{rows.length} row(s) returned
				{rowsAffected > 0 && ` · ${rowsAffected} row(s) affected`}
				{' · '}
				{executionTimeMs}ms
			</div>
			{rows.length > 0 && (
				<div className="sql-results-scroll">
					<table className="datagrid-table">
						<thead>
							<tr>
								{columns.map((col) => (
									<th key={col.name}>{col.name}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, i) => (
								<tr key={i}>
									{columns.map((col) => (
										<td key={col.name}>
											<span
												className={`cell-value ${
													row[col.name] === null ? 'null-value' : ''
												}`}
											>
												{row[col.name] === null
													? 'NULL'
													: String(row[col.name])}
											</span>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};
