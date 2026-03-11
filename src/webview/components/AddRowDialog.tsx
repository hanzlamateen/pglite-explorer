import React, { useState, useCallback } from 'react';
import { ColumnMeta } from '../../shared/protocol';

interface AddRowDialogProps {
	columns: ColumnMeta[];
	onSubmit: (row: Record<string, unknown>) => void;
	onClose: () => void;
}

export const AddRowDialog: React.FC<AddRowDialogProps> = ({
	columns,
	onSubmit,
	onClose,
}) => {
	const [values, setValues] = useState<Record<string, string>>(() => {
		const initial: Record<string, string> = {};
		for (const col of columns) {
			initial[col.name] = '';
		}
		return initial;
	});

	const handleChange = useCallback((colName: string, value: string) => {
		setValues((prev) => ({ ...prev, [colName]: value }));
	}, []);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			const row: Record<string, unknown> = {};
			for (const col of columns) {
				const val = values[col.name];
				if (val === '' && col.defaultValue !== null) {
					continue;
				}
				if (val === '' && col.isNullable) {
					row[col.name] = null;
					continue;
				}
				row[col.name] = val;
			}
			onSubmit(row);
		},
		[columns, values, onSubmit]
	);

	return (
		<div className="dialog-overlay" onClick={onClose}>
			<div className="dialog" onClick={(e) => e.stopPropagation()}>
				<div className="dialog-header">
					<h3>Insert New Row</h3>
					<button className="dialog-close" onClick={onClose}>
						×
					</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="dialog-body">
						{columns.map((col) => (
							<div key={col.name} className="form-field">
								<label className="form-label">
									{col.name}
									<span className="form-type">{col.dataType}</span>
									{!col.isNullable && !col.defaultValue && (
										<span className="form-required">*</span>
									)}
								</label>
								<input
									className="form-input"
									type="text"
									value={values[col.name]}
									onChange={(e) =>
										handleChange(col.name, e.target.value)
									}
									placeholder={
										col.defaultValue
											? `Default: ${col.defaultValue}`
											: col.isNullable
												? 'NULL'
												: 'Required'
									}
								/>
							</div>
						))}
					</div>
					<div className="dialog-footer">
						<button type="button" className="action-btn" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="action-btn primary">
							Insert
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
