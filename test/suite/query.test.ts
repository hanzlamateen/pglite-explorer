import * as assert from 'assert';

suite('Query Service', () => {
	let db: InstanceType<typeof import('@electric-sql/pglite').PGlite>;

	setup(async () => {
		const { PGlite } = await import('@electric-sql/pglite');
		db = new PGlite();
		await db.exec(`
			CREATE TABLE products (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				price NUMERIC(10,2),
				in_stock BOOLEAN DEFAULT true,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);
		await db.query(
			'INSERT INTO products (name, price) VALUES ($1, $2)',
			['Widget', 9.99]
		);
		await db.query(
			'INSERT INTO products (name, price) VALUES ($1, $2)',
			['Gadget', 24.99]
		);
		await db.query(
			'INSERT INTO products (name, price, in_stock) VALUES ($1, $2, $3)',
			['Doohickey', 4.99, false]
		);
	});

	teardown(async () => {
		if (db) {
			await db.close();
		}
	});

	test('should list tables from information_schema', async () => {
		const result = await db.query<{
			table_schema: string;
			table_name: string;
			table_type: string;
		}>(`
			SELECT table_schema, table_name, table_type
			FROM information_schema.tables
			WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
			ORDER BY table_name
		`);

		assert.ok(result.rows.length >= 1, 'Should have at least 1 table');
		const productTable = result.rows.find((r) => r.table_name === 'products');
		assert.ok(productTable, 'Should find products table');
		assert.strictEqual(productTable!.table_schema, 'public');
	});

	test('should get column metadata', async () => {
		const result = await db.query<{
			column_name: string;
			data_type: string;
			is_nullable: string;
			column_default: string | null;
		}>(`
			SELECT column_name, data_type, is_nullable, column_default
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'products'
			ORDER BY ordinal_position
		`);

		assert.ok(result.rows.length >= 5, 'Should have at least 5 columns');

		const idCol = result.rows.find((r) => r.column_name === 'id');
		assert.ok(idCol, 'Should find id column');
		assert.strictEqual(idCol!.data_type, 'integer');

		const nameCol = result.rows.find((r) => r.column_name === 'name');
		assert.ok(nameCol, 'Should find name column');
		assert.strictEqual(nameCol!.is_nullable, 'NO');
	});

	test('should get primary key information', async () => {
		const result = await db.query<{ column_name: string }>(`
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_schema = 'public'
				AND tc.table_name = 'products'
		`);

		assert.strictEqual(result.rows.length, 1);
		assert.strictEqual(result.rows[0].column_name, 'id');
	});

	test('should paginate results', async () => {
		const page1 = await db.query('SELECT * FROM products ORDER BY id LIMIT 2 OFFSET 0');
		assert.strictEqual(page1.rows.length, 2);

		const page2 = await db.query('SELECT * FROM products ORDER BY id LIMIT 2 OFFSET 2');
		assert.strictEqual(page2.rows.length, 1);
	});

	test('should insert a row', async () => {
		await db.query(
			'INSERT INTO products (name, price) VALUES ($1, $2)',
			['New Item', 15.0]
		);

		const result = await db.query<{ count: string }>(
			'SELECT COUNT(*) as count FROM products'
		);
		assert.strictEqual(parseInt(result.rows[0].count, 10), 4);
	});

	test('should update a row', async () => {
		await db.query(
			'UPDATE products SET price = $1 WHERE name = $2',
			[19.99, 'Widget']
		);

		const result = await db.query<{ price: string }>(
			'SELECT price FROM products WHERE name = $1',
			['Widget']
		);
		assert.strictEqual(parseFloat(result.rows[0].price), 19.99);
	});

	test('should delete a row', async () => {
		await db.query('DELETE FROM products WHERE name = $1', ['Doohickey']);

		const result = await db.query<{ count: string }>(
			'SELECT COUNT(*) as count FROM products'
		);
		assert.strictEqual(parseInt(result.rows[0].count, 10), 2);
	});

	test('should execute raw SQL queries', async () => {
		const result = await db.query<{ name: string; price: number }>(
			'SELECT name, price FROM products WHERE price > $1 ORDER BY price DESC',
			[5.0]
		);

		assert.strictEqual(result.rows.length, 2);
		assert.strictEqual(result.rows[0].name, 'Gadget');
	});

	test('should get index information', async () => {
		const result = await db.query<{
			indexname: string;
			indexdef: string;
		}>(`
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = 'public' AND tablename = 'products'
		`);

		assert.ok(result.rows.length >= 1, 'Should have at least 1 index (pkey)');
		const pkIdx = result.rows.find((r) => r.indexname.includes('pkey'));
		assert.ok(pkIdx, 'Should find primary key index');
	});

	test('should export data as CSV', async () => {
		const result = await db.query<Record<string, unknown>>(
			'SELECT name, price FROM products ORDER BY name'
		);
		const rows = result.rows;

		assert.ok(rows.length > 0);
		const headers = Object.keys(rows[0]);
		const csvHeader = headers.join(',');
		assert.ok(csvHeader.includes('name'));
		assert.ok(csvHeader.includes('price'));
	});
});
