import React, { useState, useCallback, useMemo } from 'react';
import { TableInfo } from '../../shared/protocol';

const PG_TYPES = [
	{ group: 'Numeric', types: ['integer', 'bigint', 'smallint', 'serial', 'bigserial', 'real', 'double precision', 'numeric'] },
	{ group: 'Text', types: ['text', 'varchar(255)', 'char(1)'] },
	{ group: 'Boolean', types: ['boolean'] },
	{ group: 'Date/Time', types: ['date', 'timestamp', 'timestamptz', 'time'] },
	{ group: 'JSON', types: ['json', 'jsonb'] },
	{ group: 'Other', types: ['uuid', 'bytea'] },
];

const FK_ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] as const;

interface ColumnDef {
	id: string;
	name: string;
	type: string;
	isPrimaryKey: boolean;
	isNullable: boolean;
	isUnique: boolean;
	defaultValue: string;
}

interface ForeignKeyDef {
	id: string;
	name: string;
	columns: string[];
	refTable: string;
	refColumns: string[];
	onDelete: string;
	onUpdate: string;
}

interface UniqueConstraintDef {
	id: string;
	name: string;
	columns: string[];
}

interface CheckConstraintDef {
	id: string;
	name: string;
	expression: string;
}

interface IndexDef {
	id: string;
	name: string;
	columns: string[];
	isUnique: boolean;
}

interface CreateTableDialogProps {
	tables: TableInfo[];
	onSubmit: (sql: string) => void;
	onClose: () => void;
}

let nextId = 0;
function uid() { return `_${++nextId}`; }

function escapeId(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
	tables,
	onSubmit,
	onClose,
}) => {
	const [tableName, setTableName] = useState('');
	const [columns, setColumns] = useState<ColumnDef[]>([
		{ id: uid(), name: '', type: 'serial', isPrimaryKey: true, isNullable: false, isUnique: false, defaultValue: '' },
		{ id: uid(), name: '', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: '' },
	]);

	const [compositePk, setCompositePk] = useState<string[]>([]);
	const [foreignKeys, setForeignKeys] = useState<ForeignKeyDef[]>([]);
	const [uniqueConstraints, setUniqueConstraints] = useState<UniqueConstraintDef[]>([]);
	const [checkConstraints, setCheckConstraints] = useState<CheckConstraintDef[]>([]);
	const [indexes, setIndexes] = useState<IndexDef[]>([]);
	const [constraintsOpen, setConstraintsOpen] = useState(false);

	const hasSinglePk = columns.some((c) => c.isPrimaryKey);

	const updateColumn = useCallback((id: string, patch: Partial<ColumnDef>) => {
		setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
	}, []);

	const addColumn = useCallback(() => {
		setColumns((prev) => [...prev, { id: uid(), name: '', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: '' }]);
	}, []);

	const removeColumn = useCallback((id: string) => {
		setColumns((prev) => prev.filter((c) => c.id !== id));
	}, []);

	const columnNames = useMemo(
		() => columns.filter((c) => c.name.trim()).map((c) => c.name),
		[columns],
	);

	const generatedSql = useMemo(() => {
		if (!tableName.trim()) return '';
		const parts: string[] = [];

		for (const col of columns) {
			if (!col.name.trim()) continue;
			let def = `  ${escapeId(col.name)} ${col.type}`;
			if (col.isPrimaryKey && !compositePk.length) def += ' PRIMARY KEY';
			if (!col.isNullable && !col.isPrimaryKey) def += ' NOT NULL';
			if (col.isUnique) def += ' UNIQUE';
			if (col.defaultValue.trim()) def += ` DEFAULT ${col.defaultValue.trim()}`;
			parts.push(def);
		}

		const validCompositePk = compositePk.filter((c) => columnNames.includes(c));
		if (validCompositePk.length > 0 && !hasSinglePk) {
			parts.push(`  PRIMARY KEY (${validCompositePk.map(escapeId).join(', ')})`);
		}

		for (const fk of foreignKeys) {
			if (!fk.columns.length || !fk.refTable || !fk.refColumns.length) continue;
			let fkSql = `  CONSTRAINT ${escapeId(fk.name || `fk_${fk.columns.join('_')}`)} FOREIGN KEY (${fk.columns.map(escapeId).join(', ')}) REFERENCES ${escapeId(fk.refTable)} (${fk.refColumns.map(escapeId).join(', ')})`;
			if (fk.onDelete && fk.onDelete !== 'NO ACTION') fkSql += ` ON DELETE ${fk.onDelete}`;
			if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') fkSql += ` ON UPDATE ${fk.onUpdate}`;
			parts.push(fkSql);
		}

		for (const uq of uniqueConstraints) {
			if (!uq.columns.length) continue;
			parts.push(`  CONSTRAINT ${escapeId(uq.name || `uq_${uq.columns.join('_')}`)} UNIQUE (${uq.columns.map(escapeId).join(', ')})`);
		}

		for (const ck of checkConstraints) {
			if (!ck.expression.trim()) continue;
			const ckName = ck.name || `ck_${tableName}_${checkConstraints.indexOf(ck) + 1}`;
			parts.push(`  CONSTRAINT ${escapeId(ckName)} CHECK (${ck.expression.trim()})`);
		}

		let sql = `CREATE TABLE ${escapeId(tableName)} (\n${parts.join(',\n')}\n);`;

		for (const idx of indexes) {
			if (!idx.columns.length) continue;
			const uniqueKw = idx.isUnique ? 'UNIQUE ' : '';
			sql += `\nCREATE ${uniqueKw}INDEX ${escapeId(idx.name || `idx_${idx.columns.join('_')}`)} ON ${escapeId(tableName)} (${idx.columns.map(escapeId).join(', ')});`;
		}

		return sql;
	}, [tableName, columns, columnNames, compositePk, foreignKeys, uniqueConstraints, checkConstraints, indexes, hasSinglePk]);

	const duplicateColumns = useMemo(() => {
		const names = columns.filter((c) => c.name.trim()).map((c) => c.name.trim().toLowerCase());
		return names.filter((n, i) => names.indexOf(n) !== i);
	}, [columns]);

	const handleSubmit = useCallback((e: React.FormEvent) => {
		e.preventDefault();
		if (duplicateColumns.length) return;
		if (generatedSql) onSubmit(generatedSql);
	}, [generatedSql, onSubmit, duplicateColumns]);

	return (
		<div className="dialog-overlay" onClick={onClose}>
			<div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
				<div className="dialog-header">
					<h3>Create New Table</h3>
					<button className="dialog-close" onClick={onClose}>×</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="dialog-body">
						<div className="form-field">
							<label className="form-label">Table Name</label>
							<input
								className="form-input"
								type="text"
								value={tableName}
								onChange={(e) => setTableName(e.target.value)}
								placeholder="my_table"
								required
							/>
						</div>

						<div className="section-header">Columns</div>
						<div className="column-builder">
							<div className="column-builder-header">
								<span>Name</span>
								<span>Type</span>
								<span>PK</span>
								<span>NULL</span>
								<span>Unique</span>
								<span>Default</span>
								<span></span>
							</div>
							{columns.map((col) => (
								<div key={col.id} className="column-builder-row">
									<input
										className="form-input"
										type="text"
										value={col.name}
										onChange={(e) => updateColumn(col.id, { name: e.target.value })}
										placeholder="column_name"
									/>
									<select
										className="form-input"
										value={col.type}
										onChange={(e) => updateColumn(col.id, { type: e.target.value })}
									>
										{PG_TYPES.map((g) => (
											<optgroup key={g.group} label={g.group}>
												{g.types.map((t) => <option key={t} value={t}>{t}</option>)}
											</optgroup>
										))}
									</select>
									<input
										type="checkbox"
										checked={col.isPrimaryKey}
										onChange={(e) => updateColumn(col.id, { isPrimaryKey: e.target.checked })}
										title="Primary Key"
									/>
									<input
										type="checkbox"
										checked={col.isNullable}
										onChange={(e) => updateColumn(col.id, { isNullable: e.target.checked })}
										title="Nullable"
									/>
									<input
										type="checkbox"
										checked={col.isUnique}
										onChange={(e) => updateColumn(col.id, { isUnique: e.target.checked })}
										title="Unique"
									/>
									<input
										className="form-input"
										type="text"
										value={col.defaultValue}
										onChange={(e) => updateColumn(col.id, { defaultValue: e.target.value })}
										placeholder="Default"
									/>
									<button
										type="button"
										className="btn-icon btn-danger"
										onClick={() => removeColumn(col.id)}
										title="Remove column"
										disabled={columns.length <= 1}
									>
										✕
									</button>
								</div>
							))}
						</div>
						<button type="button" className="action-btn" onClick={addColumn}>+ Add Column</button>

						<div className="section-header section-toggle" onClick={() => setConstraintsOpen(!constraintsOpen)}>
							<span>{constraintsOpen ? '▾' : '▸'} Constraints &amp; Indexes</span>
						</div>

						{constraintsOpen && (
							<div className="constraints-section">
								{/* Composite Primary Key */}
								{!hasSinglePk && (
									<div className="constraint-group">
										<label className="form-label">Composite Primary Key</label>
										<div className="multi-select-row">
											{columnNames.map((cn) => (
												<label key={cn} className="checkbox-label">
													<input
														type="checkbox"
														checked={compositePk.includes(cn)}
														onChange={(e) => {
															setCompositePk((prev) =>
																e.target.checked ? [...prev, cn] : prev.filter((x) => x !== cn)
															);
														}}
													/>
													{cn}
												</label>
											))}
										</div>
									</div>
								)}

								{/* Foreign Keys */}
								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Foreign Keys</label>
										<button type="button" className="action-btn small" onClick={() => setForeignKeys((prev) => [...prev, { id: uid(), name: '', columns: [], refTable: '', refColumns: [], onDelete: 'NO ACTION', onUpdate: 'NO ACTION' }])}>+ Add FK</button>
									</div>
									{foreignKeys.map((fk) => (
										<div key={fk.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Constraint name" value={fk.name} onChange={(e) => setForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, name: e.target.value } : f))} />
											<select className="form-input" value={fk.columns[0] ?? ''} onChange={(e) => setForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, columns: [e.target.value] } : f))}>
												<option value="">Column...</option>
												{columnNames.map((cn) => <option key={cn} value={cn}>{cn}</option>)}
											</select>
											<span className="constraint-arrow">→</span>
											<select className="form-input" value={fk.refTable} onChange={(e) => setForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, refTable: e.target.value, refColumns: [] } : f))}>
												<option value="">Ref table...</option>
												{tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
											</select>
											<input className="form-input" type="text" placeholder="Ref column" value={fk.refColumns[0] ?? ''} onChange={(e) => setForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, refColumns: [e.target.value] } : f))} />
											<select className="form-input" value={fk.onDelete} onChange={(e) => setForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, onDelete: e.target.value } : f))}>
												{FK_ACTIONS.map((a) => <option key={a} value={a}>DEL: {a}</option>)}
											</select>
											<select className="form-input" value={fk.onUpdate} onChange={(e) => setForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, onUpdate: e.target.value } : f))}>
												{FK_ACTIONS.map((a) => <option key={a} value={a}>UPD: {a}</option>)}
											</select>
											<button type="button" className="btn-icon btn-danger" onClick={() => setForeignKeys((prev) => prev.filter((f) => f.id !== fk.id))}>✕</button>
										</div>
									))}
								</div>

								{/* Unique Constraints */}
								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Unique Constraints</label>
										<button type="button" className="action-btn small" onClick={() => setUniqueConstraints((prev) => [...prev, { id: uid(), name: '', columns: [] }])}>+ Add Unique</button>
									</div>
									{uniqueConstraints.map((uq) => (
										<div key={uq.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Constraint name" value={uq.name} onChange={(e) => setUniqueConstraints((prev) => prev.map((u) => u.id === uq.id ? { ...u, name: e.target.value } : u))} />
											<div className="multi-select-row">
												{columnNames.map((cn) => (
													<label key={cn} className="checkbox-label">
														<input
															type="checkbox"
															checked={uq.columns.includes(cn)}
															onChange={(e) => {
																setUniqueConstraints((prev) => prev.map((u) =>
																	u.id === uq.id ? { ...u, columns: e.target.checked ? [...u.columns, cn] : u.columns.filter((x) => x !== cn) } : u
																));
															}}
														/>
														{cn}
													</label>
												))}
											</div>
											<button type="button" className="btn-icon btn-danger" onClick={() => setUniqueConstraints((prev) => prev.filter((u) => u.id !== uq.id))}>✕</button>
										</div>
									))}
								</div>

								{/* Check Constraints */}
								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Check Constraints</label>
										<button type="button" className="action-btn small" onClick={() => setCheckConstraints((prev) => [...prev, { id: uid(), name: '', expression: '' }])}>+ Add Check</button>
									</div>
									{checkConstraints.map((ck) => (
										<div key={ck.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Constraint name" value={ck.name} onChange={(e) => setCheckConstraints((prev) => prev.map((c) => c.id === ck.id ? { ...c, name: e.target.value } : c))} />
											<input className="form-input constraint-expr" type="text" placeholder="Expression, e.g. price > 0" value={ck.expression} onChange={(e) => setCheckConstraints((prev) => prev.map((c) => c.id === ck.id ? { ...c, expression: e.target.value } : c))} />
											<button type="button" className="btn-icon btn-danger" onClick={() => setCheckConstraints((prev) => prev.filter((c) => c.id !== ck.id))}>✕</button>
										</div>
									))}
								</div>

								{/* Indexes */}
								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Indexes</label>
										<button type="button" className="action-btn small" onClick={() => setIndexes((prev) => [...prev, { id: uid(), name: '', columns: [], isUnique: false }])}>+ Add Index</button>
									</div>
									{indexes.map((idx) => (
										<div key={idx.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Index name" value={idx.name} onChange={(e) => setIndexes((prev) => prev.map((i) => i.id === idx.id ? { ...i, name: e.target.value } : i))} />
											<div className="multi-select-row">
												{columnNames.map((cn) => (
													<label key={cn} className="checkbox-label">
														<input
															type="checkbox"
															checked={idx.columns.includes(cn)}
															onChange={(e) => {
																setIndexes((prev) => prev.map((i) =>
																	i.id === idx.id ? { ...i, columns: e.target.checked ? [...i.columns, cn] : i.columns.filter((x) => x !== cn) } : i
																));
															}}
														/>
														{cn}
													</label>
												))}
											</div>
											<label className="checkbox-label">
												<input type="checkbox" checked={idx.isUnique} onChange={(e) => setIndexes((prev) => prev.map((i) => i.id === idx.id ? { ...i, isUnique: e.target.checked } : i))} />
												Unique
											</label>
											<button type="button" className="btn-icon btn-danger" onClick={() => setIndexes((prev) => prev.filter((i) => i.id !== idx.id))}>✕</button>
										</div>
									))}
								</div>
							</div>
						)}

						{generatedSql && (
							<>
								<div className="section-header">SQL Preview</div>
								<pre className="sql-preview">{generatedSql}</pre>
							</>
						)}
					</div>
					<div className="dialog-footer">
						{duplicateColumns.length > 0 && (
							<span className="form-error">Duplicate column names: {duplicateColumns.join(', ')}</span>
						)}
						<button type="button" className="action-btn" onClick={onClose}>Cancel</button>
						<button type="submit" className="action-btn primary" disabled={!generatedSql || duplicateColumns.length > 0}>Create Table</button>
					</div>
				</form>
			</div>
		</div>
	);
};
