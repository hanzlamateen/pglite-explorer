import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	ColumnDef,
	SortingState,
} from '@tanstack/react-table';
import { ColumnMeta } from '../../shared/protocol';

interface DataGridProps {
	columns: ColumnMeta[];
	rows: Record<string, unknown>[];
	totalCount: number;
	page: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	onSort: (columnName: string, dir: 'ASC' | 'DESC') => void;
	onFilter: (where: string) => void;
	onUpdateRow: (pk: Record<string, unknown>, changes: Record<string, unknown>) => void;
	onDeleteRows: (pks: Record<string, unknown>[]) => void;
	onAddRow: () => void;
}

export const DataGrid: React.FC<DataGridProps> = ({
	columns,
	rows,
	totalCount,
	page,
	pageSize,
	onPageChange,
	onSort,
	onFilter,
	onUpdateRow,
	onDeleteRows,
	onAddRow,
}) => {
	const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
	const [sorting, setSorting] = useState<SortingState>([]);
	const [filterColumn, setFilterColumn] = useState('');
	const [filterOp, setFilterOp] = useState('=');
	const [filterValue, setFilterValue] = useState('');
	const [appliedFilter, setAppliedFilter] = useState<{ column: string; op: string; value: string } | null>(null);

	const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
	const editingRowValuesRef = useRef<Record<string, string>>({});
	const firstEditInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editingRowIndex !== null && firstEditInputRef.current) {
			firstEditInputRef.current.focus();
		}
	}, [editingRowIndex]);

	useEffect(() => {
		editingRowValuesRef.current = {};
		setEditingRowIndex(null);
		setSelectedRows(new Set());
	}, [rows]);

	const pkColumns = useMemo(
		() => columns.filter((c) => c.isPrimaryKey).map((c) => c.name),
		[columns]
	);

	const getPk = useCallback(
		(row: Record<string, unknown>): Record<string, unknown> => {
			const pk: Record<string, unknown> = {};
			for (const col of pkColumns) {
				pk[col] = row[col];
			}
			if (pkColumns.length === 0 && columns.length > 0) {
				for (const col of columns) {
					pk[col.name] = row[col.name];
				}
			}
			return pk;
		},
		[pkColumns, columns]
	);

	const toggleRow = useCallback((index: number) => {
		setSelectedRows((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const toggleAll = useCallback(() => {
		setSelectedRows((prev) => {
			if (prev.size === rows.length) {
				return new Set();
			}
			return new Set(rows.map((_, i) => i));
		});
	}, [rows]);

	const startEditRow = useCallback(
		(rowIndex: number) => {
			const row = rows[rowIndex];
			const values: Record<string, string> = {};
			for (const col of columns) {
				const val = row[col.name];
				values[col.name] = val === null || val === undefined ? '' : String(val);
			}
			editingRowValuesRef.current = values;
			setEditingRowIndex(rowIndex);
		},
		[rows, columns]
	);

	const saveEditRow = useCallback(() => {
		if (editingRowIndex === null) return;
		const row = rows[editingRowIndex];
		const editValues = editingRowValuesRef.current;
		const changes: Record<string, unknown> = {};

		for (const col of columns) {
			const oldVal = row[col.name];
			const newVal = editValues[col.name] === '' ? null : editValues[col.name];
			if (String(oldVal ?? '') !== String(newVal ?? '')) {
				changes[col.name] = newVal;
			}
		}

		if (Object.keys(changes).length > 0) {
			onUpdateRow(getPk(row), changes);
		}
		editingRowValuesRef.current = {};
		setEditingRowIndex(null);
	}, [editingRowIndex, rows, columns, getPk, onUpdateRow]);

	const cancelEditRow = useCallback(() => {
		editingRowValuesRef.current = {};
		setEditingRowIndex(null);
	}, []);

	const handleDeleteRow = useCallback(
		(rowIndex: number) => {
			const row = rows[rowIndex];
			onDeleteRows([getPk(row)]);
		},
		[rows, getPk, onDeleteRows]
	);

	const handleDeleteSelected = useCallback(() => {
		const pks = Array.from(selectedRows).map((i) => getPk(rows[i]));
		onDeleteRows(pks);
		setSelectedRows(new Set());
	}, [selectedRows, rows, getPk, onDeleteRows]);

	const hasFilterInput = filterColumn !== '' && filterValue !== '';

	const filterIsDirty = useMemo(() => {
		if (!appliedFilter) return hasFilterInput;
		return (
			appliedFilter.column !== filterColumn ||
			appliedFilter.op !== filterOp ||
			appliedFilter.value !== filterValue
		);
	}, [appliedFilter, filterColumn, filterOp, filterValue, hasFilterInput]);

	const handleApplyFilter = useCallback(() => {
		if (!filterColumn || !filterValue) {
			onFilter('');
			setAppliedFilter(null);
			return;
		}
		const ops: Record<string, string> = {
			'=': '=',
			'!=': '!=',
			'>': '>',
			'<': '<',
			'LIKE': 'LIKE',
			'ILIKE': 'ILIKE',
		};
		const op = ops[filterOp] || '=';
		const where = `"${filterColumn}" ${op} '${filterValue.replace(/'/g, "''")}'`;
		onFilter(where);
		setAppliedFilter({ column: filterColumn, op: filterOp, value: filterValue });
	}, [filterColumn, filterOp, filterValue, onFilter]);

	const handleCancelFilter = useCallback(() => {
		if (appliedFilter) {
			setFilterColumn(appliedFilter.column);
			setFilterOp(appliedFilter.op);
			setFilterValue(appliedFilter.value);
		} else {
			setFilterColumn('');
			setFilterOp('=');
			setFilterValue('');
		}
	}, [appliedFilter]);

	const handleClearFilter = useCallback(() => {
		setFilterColumn('');
		setFilterOp('=');
		setFilterValue('');
		setAppliedFilter(null);
		onFilter('');
	}, [onFilter]);

	const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
		return columns.map((col) => ({
			id: col.name,
			accessorKey: col.name,
			header: col.name,
			cell: ({ row, column }) => {
				const rowIndex = row.index;
				const colName = column.id;
				const val = row.original[colName];

				if (editingRowIndex === rowIndex) {
					return (
						<input
							ref={colName === columns[0]?.name ? firstEditInputRef : undefined}
							className="cell-edit-input"
							defaultValue={editingRowValuesRef.current[colName] ?? ''}
							onChange={(e) => {
								editingRowValuesRef.current[colName] = e.target.value;
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter') saveEditRow();
								if (e.key === 'Escape') cancelEditRow();
							}}
						/>
					);
				}

				return (
					<span
						className={`cell-value ${val === null ? 'null-value' : ''}`}
						onDoubleClick={() => startEditRow(rowIndex)}
					>
						{val === null ? 'NULL' : String(val)}
					</span>
				);
			},
		}));
	}, [columns, editingRowIndex, saveEditRow, cancelEditRow, startEditRow]);

	const table = useReactTable({
		data: rows,
		columns: tableColumns,
		state: { sorting },
		onSortingChange: (updater) => {
			const next = typeof updater === 'function' ? updater(sorting) : updater;
			setSorting(next);
			if (next.length > 0) {
				onSort(next[0].id, next[0].desc ? 'DESC' : 'ASC');
			}
		},
		getCoreRowModel: getCoreRowModel(),
		manualSorting: true,
		manualPagination: true,
		pageCount: Math.ceil(totalCount / pageSize),
	});

	const totalPages = Math.ceil(totalCount / pageSize);
	const startRow = (page - 1) * pageSize + 1;
	const endRow = Math.min(page * pageSize, totalCount);

	return (
		<div className="datagrid-container">
			<div className="datagrid-action-bar">
				<button className="action-btn primary" onClick={onAddRow}>
					+ Add Row
				</button>
				{selectedRows.size > 0 && (
					<button className="action-btn danger" onClick={handleDeleteSelected}>
						Delete Selected ({selectedRows.size})
					</button>
				)}
				<div className="filter-bar">
					<select
						className="filter-select"
						value={filterColumn}
						onChange={(e) => setFilterColumn(e.target.value)}
					>
						<option value="">Column...</option>
						{columns.map((c) => (
							<option key={c.name} value={c.name}>
								{c.name}
							</option>
						))}
					</select>
					<select
						className="filter-select filter-op"
						value={filterOp}
						onChange={(e) => setFilterOp(e.target.value)}
					>
						<option value="=">=</option>
						<option value="!=">!=</option>
						<option value=">">{'>'}</option>
						<option value="<">{'<'}</option>
						<option value="LIKE">LIKE</option>
						<option value="ILIKE">ILIKE</option>
					</select>
					<input
						className="filter-input"
						placeholder="Value..."
						value={filterValue}
						onChange={(e) => setFilterValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleApplyFilter();
						}}
					/>
					<button
						className="action-btn primary"
						onClick={handleApplyFilter}
						disabled={!hasFilterInput || !filterIsDirty}
					>
						Apply
					</button>
					{filterIsDirty && (hasFilterInput || appliedFilter) && (
						<button className="action-btn" onClick={handleCancelFilter}>
							Cancel
						</button>
					)}
					{appliedFilter && (
						<button className="action-btn danger" onClick={handleClearFilter}>
							Clear Filter
						</button>
					)}
				</div>
			</div>

			<div className="datagrid-scroll">
				<table className="datagrid-table">
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								<th className="checkbox-col">
									<input
										type="checkbox"
										checked={selectedRows.size === rows.length && rows.length > 0}
										onChange={toggleAll}
									/>
								</th>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className={`sortable-header ${
											sorting.find((s) => s.id === header.id)
												? sorting.find((s) => s.id === header.id)?.desc
													? 'sort-desc'
													: 'sort-asc'
												: ''
										}`}
										onClick={header.column.getToggleSortingHandler()}
									>
										{flexRender(
											header.column.columnDef.header,
											header.getContext()
										)}
										<span className="sort-indicator">
											{sorting.find((s) => s.id === header.id)
												? sorting.find((s) => s.id === header.id)?.desc
													? ' ▾'
													: ' ▴'
												: ''}
										</span>
									</th>
								))}
								<th className="actions-col-header">Actions</th>
							</tr>
						))}
					</thead>
					<tbody>
						{rows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length + 2}
									className="empty-message"
								>
									No rows found
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className={`${selectedRows.has(row.index) ? 'selected-row' : ''} ${editingRowIndex === row.index ? 'editing-row' : ''}`}
								>
									<td className="checkbox-col">
										<input
											type="checkbox"
											checked={selectedRows.has(row.index)}
											onChange={() => toggleRow(row.index)}
										/>
									</td>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</td>
									))}
									<td className="actions-col">
										{editingRowIndex === row.index ? (
											<div className="row-actions">
												<button
													className="row-action-btn save"
													onClick={saveEditRow}
													title="Save changes"
												>
													✓
												</button>
												<button
													className="row-action-btn cancel"
													onClick={cancelEditRow}
													title="Cancel editing"
												>
													✕
												</button>
											</div>
										) : (
											<div className="row-actions">
												<button
													className="row-action-btn edit"
													onClick={() => startEditRow(row.index)}
													title="Edit row"
												>
													✎
												</button>
												<button
													className="row-action-btn delete"
													onClick={() => handleDeleteRow(row.index)}
													title="Delete row"
												>
													🗑
												</button>
											</div>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<div className="datagrid-pagination">
				<span className="pagination-info">
					{totalCount > 0
						? `Showing ${startRow}-${endRow} of ${totalCount} rows`
						: 'No rows'}
				</span>
				<div className="pagination-controls">
					<button
						className="pagination-btn"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						‹ Prev
					</button>
					<span className="pagination-page">
						Page {page} of {totalPages || 1}
					</span>
					<button
						className="pagination-btn"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
					>
						Next ›
					</button>
				</div>
			</div>
		</div>
	);
};
