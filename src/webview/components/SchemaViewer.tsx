import React from 'react';
import { TableSchema } from '../../shared/protocol';

interface SchemaViewerProps {
	schema: TableSchema | null;
	loading: boolean;
	onEditSchema?: () => void;
}

export const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, loading, onEditSchema }) => {
	if (loading) {
		return <div className="schema-loading">Loading schema...</div>;
	}

	if (!schema) {
		return (
			<div className="schema-empty">Select a table to view its schema</div>
		);
	}

	return (
		<div className="schema-viewer">
			<div className="schema-header">
				<h3 className="schema-title">{schema.tableName}</h3>
				{onEditSchema && (
					<button className="action-btn primary" onClick={onEditSchema}>
						✎ Edit Schema
					</button>
				)}
			</div>

			<div className="schema-section">
				<h4 className="schema-section-title">Columns</h4>
				<table className="schema-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Type</th>
							<th>Nullable</th>
							<th>Default</th>
							<th>Primary Key</th>
						</tr>
					</thead>
					<tbody>
						{schema.columns.map((col) => (
							<tr key={col.name}>
								<td className="schema-col-name">{col.name}</td>
								<td className="schema-col-type">{col.dataType}</td>
								<td>{col.isNullable ? 'YES' : 'NO'}</td>
								<td className="schema-col-default">
									{col.defaultValue ?? '—'}
								</td>
								<td>{col.isPrimaryKey ? '🔑' : ''}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{schema.constraints.length > 0 && (
				<div className="schema-section">
					<h4 className="schema-section-title">Constraints</h4>
					<table className="schema-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Type</th>
								<th>Columns</th>
							</tr>
						</thead>
						<tbody>
							{schema.constraints.map((c) => (
								<tr key={c.name}>
									<td>{c.name}</td>
									<td className="constraint-type">{c.type}</td>
									<td>{c.columns.join(', ')}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{schema.indexes.length > 0 && (
				<div className="schema-section">
					<h4 className="schema-section-title">Indexes</h4>
					<table className="schema-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Columns</th>
								<th>Unique</th>
								<th>Definition</th>
							</tr>
						</thead>
						<tbody>
							{schema.indexes.map((idx) => (
								<tr key={idx.name}>
									<td>{idx.name}</td>
									<td>{idx.columns.join(', ')}</td>
									<td>{idx.isUnique ? 'YES' : 'NO'}</td>
									<td className="index-definition">{idx.definition}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};
