import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Connection Manager', () => {
	let tmpDir: string;

	setup(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pglite-conn-test-'));
	});

	teardown(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test('should import PGlite module', async () => {
		const pglite = await import('@electric-sql/pglite');
		assert.ok(pglite.PGlite, 'PGlite class should be available');
	});

	test('should create an in-memory PGlite instance', async () => {
		const { PGlite } = await import('@electric-sql/pglite');
		const db = new PGlite();

		const result = await db.query('SELECT 1 as value');
		assert.strictEqual(result.rows.length, 1);
		assert.strictEqual((result.rows[0] as { value: number }).value, 1);

		await db.close();
	});

	test('should create tables and query them', async () => {
		const { PGlite } = await import('@electric-sql/pglite');
		const db = new PGlite();

		await db.exec(`
			CREATE TABLE test_users (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT
			)
		`);

		await db.query(
			'INSERT INTO test_users (name, email) VALUES ($1, $2)',
			['Alice', 'alice@test.com']
		);

		const result = await db.query<{ id: number; name: string; email: string }>(
			'SELECT * FROM test_users'
		);
		assert.strictEqual(result.rows.length, 1);
		assert.strictEqual(result.rows[0].name, 'Alice');
		assert.strictEqual(result.rows[0].email, 'alice@test.com');

		await db.close();
	});

	test('should persist to filesystem', async () => {
		const dbPath = path.join(tmpDir, 'persist-db');
		const { PGlite } = await import('@electric-sql/pglite');

		const db = new PGlite(dbPath);
		await db.exec('CREATE TABLE persist_test (id SERIAL PRIMARY KEY, val TEXT)');
		await db.query('INSERT INTO persist_test (val) VALUES ($1)', ['hello']);
		await db.close();

		assert.ok(fs.existsSync(dbPath), 'Database directory should exist');
		assert.ok(
			fs.existsSync(path.join(dbPath, 'PG_VERSION')),
			'PG_VERSION file should exist'
		);

		const db2 = new PGlite(dbPath);
		const result = await db2.query<{ val: string }>('SELECT val FROM persist_test');
		assert.strictEqual(result.rows.length, 1);
		assert.strictEqual(result.rows[0].val, 'hello');
		await db2.close();
	});
});
