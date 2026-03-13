import React, { useState, useCallback, useMemo } from 'react';
import { TableInfo, TableSchema } from '../../shared/protocol';

const PG_TYPES = [
	{ group: 'Numeric', types: ['integer', 'bigint', 'smallint', 'serial', 'bigserial', 'real', 'double precision', 'numeric'] },
	{ group: 'Text', types: ['text', 'varchar(255)', 'char(1)'] },
	{ group: 'Boolean', types: ['boolean'] },
	{ group: 'Date/Time', types: ['date', 'timestamp', 'timestamptz', 'time'] },
	{ group: 'JSON', types: ['json', 'jsonb'] },
	{ group: 'Other', types: ['uuid', 'bytea'] },
];

const FK_ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] as const;

interface EditedColumn {
	originalName: string | null;
	name: string;
	type: string;
	isNullable: boolean;
	defaultValue: string;
	isPrimaryKey: boolean;
	isNew: boolean;
	isDropped: boolean;
}

interface NewForeignKey {
	id: string;
	name: string;
	column: string;
	refTable: string;
	refColumn: string;
	onDelete: string;
	onUpdate: string;
}

interface NewUniqueConstraint {
	id: string;
	name: string;
	columns: string[];
}

interface NewCheckConstraint {
	id: string;
	name: string;
	expression: string;
}

interface NewIndex {
	id: string;
	name: string;
	columns: string[];
	isUnique: boolean;
}

interface EditTableDialogProps {
	schema: TableSchema;
	tables: TableInfo[];
	onSubmit: (sql: string, tableName: string) => void;
	onClose: () => void;
}

let nextId = 0;
function uid() { return `_e${++nextId}`; }

function escapeId(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

export const EditTableDialog: React.FC<EditTableDialogProps> = ({
	schema,
	tables,
	onSubmit,
	onClose,
}) => {
	const [tableName, setTableName] = useState(schema.tableName);
	const [columns, setColumns] = useState<EditedColumn[]>(() =>
		schema.columns.map((c) => ({
			originalName: c.name,
			name: c.name,
			type: c.dataType,
			isNullable: c.isNullable,
			defaultValue: c.defaultValue ?? '',
			isPrimaryKey: c.isPrimaryKey,
			isNew: false,
			isDropped: false,
		}))
	);

	const [droppedConstraints, setDroppedConstraints] = useState<Set<string>>(new Set());
	const [droppedIndexes, setDroppedIndexes] = useState<Set<string>>(new Set());

	const [newForeignKeys, setNewForeignKeys] = useState<NewForeignKey[]>([]);
	const [newUniqueConstraints, setNewUniqueConstraints] = useState<NewUniqueConstraint[]>([]);
	const [newCheckConstraints, setNewCheckConstraints] = useState<NewCheckConstraint[]>([]);
	const [newIndexes, setNewIndexes] = useState<NewIndex[]>([]);

	const [activeSection, setActiveSection] = useState<'columns' | 'constraints' | 'indexes'>('columns');

	const updateColumn = useCallback((idx: number, patch: Partial<EditedColumn>) => {
		setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
	}, []);

	const addColumn = useCallback(() => {
		setColumns((prev) => [...prev, {
			originalName: null,
			name: '',
			type: 'text',
			isNullable: true,
			defaultValue: '',
			isPrimaryKey: false,
			isNew: true,
			isDropped: false,
		}]);
	}, []);

	const activeColumnNames = columns.filter((c) => !c.isDropped && c.name.trim()).map((c) => c.name);

	const existingConstraints = schema.constraints.filter((c) => c.type !== 'PRIMARY KEY');
	const existingIndexes = schema.indexes;

	const generatedStatements = useMemo(() => {
		const stmts: string[] = [];
		const tbl = escapeId(schema.tableName);

		// 1. Drop removed constraints
		for (const name of droppedConstraints) {
			stmts.push(`ALTER TABLE ${tbl} DROP CONSTRAINT ${escapeId(name)}`);
		}

		// 2. Drop removed indexes
		for (const name of droppedIndexes) {
			stmts.push(`DROP INDEX ${escapeId(name)}`);
		}

		// 3. Column renames
		for (const col of columns) {
			if (!col.isNew && !col.isDropped && col.originalName && col.name !== col.originalName) {
				stmts.push(`ALTER TABLE ${tbl} RENAME COLUMN ${escapeId(col.originalName)} TO ${escapeId(col.name)}`);
			}
		}

		// 4. Column type/nullable/default changes
		for (const col of columns) {
			if (col.isNew || col.isDropped || !col.originalName) continue;
			const orig = schema.columns.find((c) => c.name === col.originalName);
			if (!orig) continue;

			const colRef = escapeId(col.name);

			if (col.type !== orig.dataType) {
				stmts.push(`ALTER TABLE ${tbl} ALTER COLUMN ${colRef} TYPE ${col.type}`);
			}

			if (col.isNullable !== orig.isNullable) {
				stmts.push(`ALTER TABLE ${tbl} ALTER COLUMN ${colRef} ${col.isNullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`);
			}

			const origDefault = orig.defaultValue ?? '';
			if (col.defaultValue !== origDefault) {
				if (col.defaultValue.trim()) {
					stmts.push(`ALTER TABLE ${tbl} ALTER COLUMN ${colRef} SET DEFAULT ${col.defaultValue.trim()}`);
				} else {
					stmts.push(`ALTER TABLE ${tbl} ALTER COLUMN ${colRef} DROP DEFAULT`);
				}
			}
		}

		// 5. Drop columns
		for (const col of columns) {
			if (col.isDropped && col.originalName) {
				stmts.push(`ALTER TABLE ${tbl} DROP COLUMN ${escapeId(col.originalName)}`);
			}
		}

		// 6. Add new columns
		for (const col of columns) {
			if (!col.isNew || col.isDropped || !col.name.trim()) continue;
			let def = `ALTER TABLE ${tbl} ADD COLUMN ${escapeId(col.name)} ${col.type}`;
			if (!col.isNullable) def += ' NOT NULL';
			if (col.defaultValue.trim()) def += ` DEFAULT ${col.defaultValue.trim()}`;
			stmts.push(def);
		}

		// 7. Add new constraints
		for (const fk of newForeignKeys) {
			if (!fk.column || !fk.refTable || !fk.refColumn) continue;
			let s = `ALTER TABLE ${tbl} ADD CONSTRAINT ${escapeId(fk.name || `fk_${fk.column}`)} FOREIGN KEY (${escapeId(fk.column)}) REFERENCES ${escapeId(fk.refTable)} (${escapeId(fk.refColumn)})`;
			if (fk.onDelete && fk.onDelete !== 'NO ACTION') s += ` ON DELETE ${fk.onDelete}`;
			if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') s += ` ON UPDATE ${fk.onUpdate}`;
			stmts.push(s);
		}

		for (const uq of newUniqueConstraints) {
			if (!uq.columns.length) continue;
			stmts.push(`ALTER TABLE ${tbl} ADD CONSTRAINT ${escapeId(uq.name || `uq_${uq.columns.join('_')}`)} UNIQUE (${uq.columns.map(escapeId).join(', ')})`);
		}

		for (const ck of newCheckConstraints) {
			if (!ck.expression.trim()) continue;
			stmts.push(`ALTER TABLE ${tbl} ADD CONSTRAINT ${escapeId(ck.name || `ck_${schema.tableName}`)} CHECK (${ck.expression.trim()})`);
		}

		for (const idx of newIndexes) {
			if (!idx.columns.length) continue;
			const uKw = idx.isUnique ? 'UNIQUE ' : '';
			stmts.push(`CREATE ${uKw}INDEX ${escapeId(idx.name || `idx_${idx.columns.join('_')}`)} ON ${tbl} (${idx.columns.map(escapeId).join(', ')})`);
		}

		// 8. Table rename (last)
		if (tableName !== schema.tableName && tableName.trim()) {
			stmts.push(`ALTER TABLE ${tbl} RENAME TO ${escapeId(tableName)}`);
		}

		return stmts;
	}, [schema, tableName, columns, droppedConstraints, droppedIndexes, newForeignKeys, newUniqueConstraints, newCheckConstraints, newIndexes]);

	const combinedSql = generatedStatements.join(';\n');

	const handleSubmit = useCallback((e: React.FormEvent) => {
		e.preventDefault();
		if (generatedStatements.length > 0) {
			onSubmit(generatedStatements.join(';'), tableName || schema.tableName);
		}
	}, [generatedStatements, onSubmit, tableName, schema.tableName]);

	return (
		<div className="dialog-overlay" onClick={onClose}>
			<div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
				<div className="dialog-header">
					<h3>Edit Table: {schema.tableName}</h3>
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
							/>
						</div>

						<div className="edit-tabs">
							<button type="button" className={`edit-tab ${activeSection === 'columns' ? 'active' : ''}`} onClick={() => setActiveSection('columns')}>Columns</button>
							<button type="button" className={`edit-tab ${activeSection === 'constraints' ? 'active' : ''}`} onClick={() => setActiveSection('constraints')}>Constraints</button>
							<button type="button" className={`edit-tab ${activeSection === 'indexes' ? 'active' : ''}`} onClick={() => setActiveSection('indexes')}>Indexes</button>
						</div>

						{activeSection === 'columns' && (
							<>
								<div className="column-builder">
									<div className="column-builder-header edit-col-header">
										<span>Name</span>
										<span>Type</span>
										<span>NULL</span>
										<span>Default</span>
										<span></span>
									</div>
									{columns.map((col, idx) => (
										<div key={col.originalName ?? `new-${idx}`} className={`column-builder-row ${col.isDropped ? 'row-dropped' : ''} ${col.isNew ? 'row-new' : ''}`}>
											<input
												className="form-input"
												type="text"
												value={col.name}
												onChange={(e) => updateColumn(idx, { name: e.target.value })}
												disabled={col.isDropped || col.isPrimaryKey}
												placeholder="column_name"
											/>
											<select
												className="form-input"
												value={col.type}
												onChange={(e) => updateColumn(idx, { type: e.target.value })}
												disabled={col.isDropped || col.isPrimaryKey}
											>
												<option value={col.type}>{col.type}</option>
												{PG_TYPES.map((g) => (
													<optgroup key={g.group} label={g.group}>
														{g.types.map((t) => <option key={t} value={t}>{t}</option>)}
													</optgroup>
												))}
											</select>
											<input
												type="checkbox"
												checked={col.isNullable}
												onChange={(e) => updateColumn(idx, { isNullable: e.target.checked })}
												disabled={col.isDropped || col.isPrimaryKey}
												title="Nullable"
											/>
											<input
												className="form-input"
												type="text"
												value={col.defaultValue}
												onChange={(e) => updateColumn(idx, { defaultValue: e.target.value })}
												disabled={col.isDropped || col.isPrimaryKey}
												placeholder="Default"
											/>
											{col.isPrimaryKey ? (
												<span className="pk-badge">PK</span>
											) : (
												<button
													type="button"
													className={`btn-icon ${col.isDropped ? 'btn-undo' : 'btn-danger'}`}
													onClick={() => {
														if (col.isNew && !col.isDropped) {
															setColumns((prev) => prev.filter((_, i) => i !== idx));
														} else {
															updateColumn(idx, { isDropped: !col.isDropped });
														}
													}}
													title={col.isDropped ? 'Undo drop' : 'Drop column'}
												>
													{col.isDropped ? '↩' : '✕'}
												</button>
											)}
										</div>
									))}
								</div>
								<button type="button" className="action-btn" onClick={addColumn}>+ Add Column</button>
							</>
						)}

						{activeSection === 'constraints' && (
							<div className="constraints-section">
								{existingConstraints.length > 0 && (
									<div className="constraint-group">
										<label className="form-label">Existing Constraints</label>
										{existingConstraints.map((c) => (
											<div key={c.name} className={`constraint-existing-row ${droppedConstraints.has(c.name) ? 'row-dropped' : ''}`}>
												<span className="constraint-type-badge">{c.type}</span>
												<span className="constraint-name">{c.name}</span>
												<span className="constraint-def">{c.definition}</span>
												<button
													type="button"
													className={`btn-icon ${droppedConstraints.has(c.name) ? 'btn-undo' : 'btn-danger'}`}
													onClick={() => {
														setDroppedConstraints((prev) => {
															const next = new Set(prev);
															if (next.has(c.name)) next.delete(c.name);
															else next.add(c.name);
															return next;
														});
													}}
												>
													{droppedConstraints.has(c.name) ? '↩' : '✕'}
												</button>
											</div>
										))}
									</div>
								)}

								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Add Foreign Key</label>
										<button type="button" className="action-btn small" onClick={() => setNewForeignKeys((prev) => [...prev, { id: uid(), name: '', column: '', refTable: '', refColumn: '', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' }])}>+ Add FK</button>
									</div>
									{newForeignKeys.map((fk) => (
										<div key={fk.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Name" value={fk.name} onChange={(e) => setNewForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, name: e.target.value } : f))} />
											<select className="form-input" value={fk.column} onChange={(e) => setNewForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, column: e.target.value } : f))}>
												<option value="">Column...</option>
												{activeColumnNames.map((cn) => <option key={cn} value={cn}>{cn}</option>)}
											</select>
											<span className="constraint-arrow">→</span>
											<select className="form-input" value={fk.refTable} onChange={(e) => setNewForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, refTable: e.target.value } : f))}>
												<option value="">Ref table...</option>
												{tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
											</select>
											<input className="form-input" type="text" placeholder="Ref col" value={fk.refColumn} onChange={(e) => setNewForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, refColumn: e.target.value } : f))} />
											<select className="form-input" value={fk.onDelete} onChange={(e) => setNewForeignKeys((prev) => prev.map((f) => f.id === fk.id ? { ...f, onDelete: e.target.value } : f))}>
												{FK_ACTIONS.map((a) => <option key={a} value={a}>DEL: {a}</option>)}
											</select>
											<button type="button" className="btn-icon btn-danger" onClick={() => setNewForeignKeys((prev) => prev.filter((f) => f.id !== fk.id))}>✕</button>
										</div>
									))}
								</div>

								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Add Unique Constraint</label>
										<button type="button" className="action-btn small" onClick={() => setNewUniqueConstraints((prev) => [...prev, { id: uid(), name: '', columns: [] }])}>+ Add Unique</button>
									</div>
									{newUniqueConstraints.map((uq) => (
										<div key={uq.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Name" value={uq.name} onChange={(e) => setNewUniqueConstraints((prev) => prev.map((u) => u.id === uq.id ? { ...u, name: e.target.value } : u))} />
											<div className="multi-select-row">
												{activeColumnNames.map((cn) => (
													<label key={cn} className="checkbox-label">
														<input type="checkbox" checked={uq.columns.includes(cn)} onChange={(e) => setNewUniqueConstraints((prev) => prev.map((u) => u.id === uq.id ? { ...u, columns: e.target.checked ? [...u.columns, cn] : u.columns.filter((x) => x !== cn) } : u))} />
														{cn}
													</label>
												))}
											</div>
											<button type="button" className="btn-icon btn-danger" onClick={() => setNewUniqueConstraints((prev) => prev.filter((u) => u.id !== uq.id))}>✕</button>
										</div>
									))}
								</div>

								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Add Check Constraint</label>
										<button type="button" className="action-btn small" onClick={() => setNewCheckConstraints((prev) => [...prev, { id: uid(), name: '', expression: '' }])}>+ Add Check</button>
									</div>
									{newCheckConstraints.map((ck) => (
										<div key={ck.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Name" value={ck.name} onChange={(e) => setNewCheckConstraints((prev) => prev.map((c) => c.id === ck.id ? { ...c, name: e.target.value } : c))} />
											<input className="form-input constraint-expr" type="text" placeholder="e.g. price > 0" value={ck.expression} onChange={(e) => setNewCheckConstraints((prev) => prev.map((c) => c.id === ck.id ? { ...c, expression: e.target.value } : c))} />
											<button type="button" className="btn-icon btn-danger" onClick={() => setNewCheckConstraints((prev) => prev.filter((c) => c.id !== ck.id))}>✕</button>
										</div>
									))}
								</div>
							</div>
						)}

						{activeSection === 'indexes' && (
							<div className="constraints-section">
								{existingIndexes.length > 0 && (
									<div className="constraint-group">
										<label className="form-label">Existing Indexes</label>
										{existingIndexes.map((idx) => (
											<div key={idx.name} className={`constraint-existing-row ${droppedIndexes.has(idx.name) ? 'row-dropped' : ''}`}>
												<span className="constraint-type-badge">{idx.isUnique ? 'UNIQUE' : 'INDEX'}</span>
												<span className="constraint-name">{idx.name}</span>
												<span className="constraint-def">({idx.columns.join(', ')})</span>
												<button
													type="button"
													className={`btn-icon ${droppedIndexes.has(idx.name) ? 'btn-undo' : 'btn-danger'}`}
													onClick={() => {
														setDroppedIndexes((prev) => {
															const next = new Set(prev);
															if (next.has(idx.name)) next.delete(idx.name);
															else next.add(idx.name);
															return next;
														});
													}}
												>
													{droppedIndexes.has(idx.name) ? '↩' : '✕'}
												</button>
											</div>
										))}
									</div>
								)}

								<div className="constraint-group">
									<div className="constraint-group-header">
										<label className="form-label">Add Index</label>
										<button type="button" className="action-btn small" onClick={() => setNewIndexes((prev) => [...prev, { id: uid(), name: '', columns: [], isUnique: false }])}>+ Add Index</button>
									</div>
									{newIndexes.map((idx) => (
										<div key={idx.id} className="constraint-row">
											<input className="form-input" type="text" placeholder="Index name" value={idx.name} onChange={(e) => setNewIndexes((prev) => prev.map((i) => i.id === idx.id ? { ...i, name: e.target.value } : i))} />
											<div className="multi-select-row">
												{activeColumnNames.map((cn) => (
													<label key={cn} className="checkbox-label">
														<input type="checkbox" checked={idx.columns.includes(cn)} onChange={(e) => setNewIndexes((prev) => prev.map((i) => i.id === idx.id ? { ...i, columns: e.target.checked ? [...i.columns, cn] : i.columns.filter((x) => x !== cn) } : i))} />
														{cn}
													</label>
												))}
											</div>
											<label className="checkbox-label">
												<input type="checkbox" checked={idx.isUnique} onChange={(e) => setNewIndexes((prev) => prev.map((i) => i.id === idx.id ? { ...i, isUnique: e.target.checked } : i))} />
												Unique
											</label>
											<button type="button" className="btn-icon btn-danger" onClick={() => setNewIndexes((prev) => prev.filter((i) => i.id !== idx.id))}>✕</button>
										</div>
									))}
								</div>
							</div>
						)}

						{generatedStatements.length > 0 && (
							<>
								<div className="section-header">Pending Changes ({generatedStatements.length})</div>
								<pre className="sql-preview">{combinedSql}</pre>
							</>
						)}
					</div>
					<div className="dialog-footer">
						<button type="button" className="action-btn" onClick={onClose}>Cancel</button>
						<button type="submit" className="action-btn primary" disabled={generatedStatements.length === 0}>Apply Changes</button>
					</div>
				</form>
			</div>
		</div>
	);
};
