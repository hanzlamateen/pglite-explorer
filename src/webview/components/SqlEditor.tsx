import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { ColumnMeta } from '../../shared/protocol';

interface SqlEditorProps {
	onExecute: (sql: string) => void;
	result: {
		columns: ColumnMeta[];
		rows: Record<string, unknown>[];
		rowsAffected: number;
		error?: string;
		executionTimeMs: number;
	} | null;
	isExecuting: boolean;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
	onExecute,
	result,
	isExecuting,
}) => {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView>();
	const [sqlText, setSqlText] = useState('SELECT * FROM ');

	useEffect(() => {
		if (!editorRef.current) return;

		const theme = EditorView.theme({
			'&': {
				backgroundColor: 'var(--vscode-editor-background)',
				color: 'var(--vscode-editor-foreground)',
				fontSize: '13px',
				height: '200px',
			},
			'.cm-content': {
				fontFamily: 'var(--vscode-editor-font-family)',
				caretColor: 'var(--vscode-editorCursor-foreground)',
			},
			'.cm-gutters': {
				backgroundColor: 'var(--vscode-editorGutter-background)',
				color: 'var(--vscode-editorLineNumber-foreground)',
				border: 'none',
			},
			'.cm-activeLine': {
				backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
			},
			'.cm-selectionBackground, .cm-content ::selection': {
				backgroundColor: 'var(--vscode-editor-selectionBackground) !important',
			},
			'&.cm-focused': {
				outline: 'none',
			},
		});

		const state = EditorState.create({
			doc: sqlText,
			extensions: [
				keymap.of([...defaultKeymap, ...historyKeymap]),
				history(),
				bracketMatching(),
				closeBrackets(),
				sql({ dialect: PostgreSQL }),
				syntaxHighlighting(defaultHighlightStyle),
				theme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						setSqlText(update.state.doc.toString());
					}
				}),
			],
		});

		const view = new EditorView({
			state,
			parent: editorRef.current,
		});
		viewRef.current = view;

		return () => {
			view.destroy();
		};
	}, []);

	const handleExecute = useCallback(() => {
		const text = sqlText.trim();
		if (text) {
			onExecute(text);
		}
	}, [sqlText, onExecute]);

	return (
		<div className="sql-editor-container">
			<div className="sql-editor-toolbar">
				<button
					className="action-btn primary"
					onClick={handleExecute}
					disabled={isExecuting}
				>
					{isExecuting ? '⏳ Executing...' : '▶ Execute'}
				</button>
			</div>
			<div ref={editorRef} className="sql-editor-cm" />
			{result && (
				<div className="sql-results">
					{result.error ? (
						<div className="sql-error">{result.error}</div>
					) : (
						<>
							<div className="sql-results-info">
								{result.rows.length} row(s) returned
								{result.rowsAffected > 0 &&
									` · ${result.rowsAffected} row(s) affected`}
								{' · '}
								{result.executionTimeMs}ms
							</div>
							{result.rows.length > 0 && (
								<div className="sql-results-scroll">
									<table className="datagrid-table">
										<thead>
											<tr>
												{result.columns.map((col) => (
													<th key={col.name}>{col.name}</th>
												))}
											</tr>
										</thead>
										<tbody>
											{result.rows.map((row, i) => (
												<tr key={i}>
													{result.columns.map((col) => (
														<td key={col.name}>
															<span
																className={`cell-value ${
																	row[col.name] === null
																		? 'null-value'
																		: ''
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
						</>
					)}
				</div>
			)}
		</div>
	);
};
