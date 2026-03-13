import { PGlite } from '@electric-sql/pglite';
import { ConnectionManager } from './connection';
import {
	TableInfo,
	ColumnMeta,
	TableSchema,
	ConstraintInfo,
	IndexInfo,
} from '../../shared/protocol';

export class QueryService {
	constructor(private connectionManager: ConnectionManager) {}

	async listTables(dbPath: string): Promise<TableInfo[]> {
		const db = await this.connectionManager.getConnection(dbPath);
		const result = await db.query<{
			table_schema: string;
			table_name: string;
			table_type: string;
		}>(`
			SELECT table_schema, table_name, table_type
			FROM information_schema.tables
			WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
			ORDER BY table_schema, table_name
		`);

		return result.rows.map((row) => ({
			schema: row.table_schema,
			name: row.table_name,
			type: row.table_type,
		}));
	}

	async getTableData(
		dbPath: string,
		table: string,
		page: number,
		pageSize: number,
		orderBy?: string,
		orderDir: 'ASC' | 'DESC' = 'ASC',
		where?: string
	): Promise<{
		columns: ColumnMeta[];
		rows: Record<string, unknown>[];
		totalCount: number;
	}> {
		const db = await this.connectionManager.getConnection(dbPath);
		const safeTable = this.escapeIdentifier(table);

		const columns = await this.getColumns(db, table);

		let countSql = `SELECT COUNT(*) as count FROM ${safeTable}`;
		let dataSql = `SELECT * FROM ${safeTable}`;

		if (where && where.trim()) {
			countSql += ` WHERE ${where}`;
			dataSql += ` WHERE ${where}`;
		}

		if (orderBy) {
			dataSql += ` ORDER BY ${this.escapeIdentifier(orderBy)} ${orderDir}`;
		}

		dataSql += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

		const [countResult, dataResult] = await Promise.all([
			db.query<{ count: string }>(countSql),
			db.query(dataSql),
		]);

		return {
			columns,
			rows: dataResult.rows as Record<string, unknown>[],
			totalCount: parseInt(countResult.rows[0]?.count ?? '0', 10),
		};
	}

	async getSchema(dbPath: string, table: string): Promise<TableSchema> {
		const db = await this.connectionManager.getConnection(dbPath);

		const columns = await this.getColumns(db, table);
		const constraints = await this.getConstraints(db, table);
		const indexes = await this.getIndexes(db, table);

		return { tableName: table, columns, constraints, indexes };
	}

	async insertRow(
		dbPath: string,
		table: string,
		row: Record<string, unknown>
	): Promise<void> {
		const db = await this.connectionManager.getConnection(dbPath);
		const safeTable = this.escapeIdentifier(table);
		const entries = Object.entries(row).filter(([, v]) => v !== undefined);
		const cols = entries.map(([k]) => this.escapeIdentifier(k)).join(', ');
		const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
		const values = entries.map(([, v]) => v);

		await db.query(`INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders})`, values);
	}

	async updateRow(
		dbPath: string,
		table: string,
		pk: Record<string, unknown>,
		changes: Record<string, unknown>
	): Promise<void> {
		const db = await this.connectionManager.getConnection(dbPath);
		const safeTable = this.escapeIdentifier(table);

		const changeEntries = Object.entries(changes);
		const pkEntries = Object.entries(pk);

		const setClauses = changeEntries
			.map((entry, i) => `${this.escapeIdentifier(entry[0])} = $${i + 1}`)
			.join(', ');

		const whereClauses = pkEntries
			.map(
				(entry, i) =>
					`${this.escapeIdentifier(entry[0])} = $${changeEntries.length + i + 1}`
			)
			.join(' AND ');

		const values = [...changeEntries.map(([, v]) => v), ...pkEntries.map(([, v]) => v)];

		await db.query(
			`UPDATE ${safeTable} SET ${setClauses} WHERE ${whereClauses}`,
			values
		);
	}

	async deleteRows(
		dbPath: string,
		table: string,
		pks: Record<string, unknown>[]
	): Promise<number> {
		const db = await this.connectionManager.getConnection(dbPath);
		const safeTable = this.escapeIdentifier(table);
		let deleted = 0;

		for (const pk of pks) {
			const entries = Object.entries(pk);
			const whereClauses = entries
				.map((entry, i) => `${this.escapeIdentifier(entry[0])} = $${i + 1}`)
				.join(' AND ');
			const values = entries.map(([, v]) => v);

			const result = await db.query(
				`DELETE FROM ${safeTable} WHERE ${whereClauses}`,
				values
			);
			deleted += result.affectedRows ?? 1;
		}

		return deleted;
	}

	async executeQuery(
		dbPath: string,
		sql: string
	): Promise<{
		columns: ColumnMeta[];
		rows: Record<string, unknown>[];
		rowsAffected: number;
		executionTimeMs: number;
	}> {
		const db = await this.connectionManager.getConnection(dbPath);
		const start = performance.now();

		const result = await db.query(sql);
		const executionTimeMs = Math.round(performance.now() - start);

		const columns: ColumnMeta[] = result.fields?.map((f, i) => ({
			name: f.name,
			dataType: f.dataTypeID?.toString() ?? 'unknown',
			isNullable: true,
			defaultValue: null,
			isPrimaryKey: false,
			ordinalPosition: i,
		})) ?? [];

		return {
			columns,
			rows: (result.rows as Record<string, unknown>[]) ?? [],
			rowsAffected: result.affectedRows ?? 0,
			executionTimeMs,
		};
	}

	async executeSqlStatements(dbPath: string, sql: string): Promise<void> {
		const db = await this.connectionManager.getConnection(dbPath);
		const statements = sql
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		for (const stmt of statements) {
			await db.query(stmt);
		}
	}

	async exportData(
		dbPath: string,
		table: string,
		format: 'csv' | 'json'
	): Promise<{ data: string; fileName: string }> {
		const db = await this.connectionManager.getConnection(dbPath);
		const safeTable = this.escapeIdentifier(table);
		const result = await db.query(`SELECT * FROM ${safeTable}`);
		const rows = result.rows as Record<string, unknown>[];

		if (format === 'json') {
			return {
				data: JSON.stringify(rows, null, 2),
				fileName: `${table}.json`,
			};
		}

		// CSV format
		if (rows.length === 0) {
			return { data: '', fileName: `${table}.csv` };
		}

		const headers = Object.keys(rows[0]);
		const csvRows = [
			headers.join(','),
			...rows.map((row) =>
				headers
					.map((h) => {
						const val = row[h];
						if (val === null || val === undefined) return '';
						const str = String(val);
						if (str.includes(',') || str.includes('"') || str.includes('\n')) {
							return `"${str.replace(/"/g, '""')}"`;
						}
						return str;
					})
					.join(',')
			),
		];

		return {
			data: csvRows.join('\n'),
			fileName: `${table}.csv`,
		};
	}

	private async getColumns(db: PGlite, table: string): Promise<ColumnMeta[]> {
		const colResult = await db.query<{
			column_name: string;
			data_type: string;
			is_nullable: string;
			column_default: string | null;
			ordinal_position: number;
		}>(`
			SELECT column_name, data_type, is_nullable, column_default, ordinal_position
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1
			ORDER BY ordinal_position
		`, [table]);

		const pkResult = await db.query<{ column_name: string }>(`
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_schema = 'public'
				AND tc.table_name = $1
		`, [table]);

		const pkColumns = new Set(pkResult.rows.map((r) => r.column_name));

		return colResult.rows.map((row) => ({
			name: row.column_name,
			dataType: row.data_type,
			isNullable: row.is_nullable === 'YES',
			defaultValue: row.column_default,
			isPrimaryKey: pkColumns.has(row.column_name),
			ordinalPosition: row.ordinal_position,
		}));
	}

	private async getConstraints(db: PGlite, table: string): Promise<ConstraintInfo[]> {
		const result = await db.query<{
			constraint_name: string;
			constraint_type: string;
			column_name: string;
		}>(`
			SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
			FROM information_schema.table_constraints tc
			LEFT JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			WHERE tc.table_schema = 'public' AND tc.table_name = $1
			ORDER BY tc.constraint_name, kcu.ordinal_position
		`, [table]);

		const grouped = new Map<string, { type: string; columns: string[] }>();
		for (const row of result.rows) {
			if (!grouped.has(row.constraint_name)) {
				grouped.set(row.constraint_name, {
					type: row.constraint_type,
					columns: [],
				});
			}
			if (row.column_name) {
				grouped.get(row.constraint_name)!.columns.push(row.column_name);
			}
		}

		return Array.from(grouped.entries()).map(([name, info]) => ({
			name,
			type: info.type as ConstraintInfo['type'],
			columns: info.columns,
			definition: `${info.type} (${info.columns.join(', ')})`,
		}));
	}

	private async getIndexes(db: PGlite, table: string): Promise<IndexInfo[]> {
		const result = await db.query<{
			indexname: string;
			indexdef: string;
		}>(`
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = 'public' AND tablename = $1
		`, [table]);

		return result.rows.map((row) => {
			const isUnique = row.indexdef.toUpperCase().includes('UNIQUE');
			const colMatch = row.indexdef.match(/\(([^)]+)\)/);
			const columns = colMatch
				? colMatch[1].split(',').map((c) => c.trim())
				: [];

			return {
				name: row.indexname,
				columns,
				isUnique,
				definition: row.indexdef,
			};
		});
	}

	private escapeIdentifier(name: string): string {
		return `"${name.replace(/"/g, '""')}"`;
	}
}
