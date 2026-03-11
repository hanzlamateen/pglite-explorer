import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Database Discovery', () => {
	let tmpDir: string;

	setup(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pglite-test-'));
	});

	teardown(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test('should detect PG_VERSION file in a directory', () => {
		const dbDir = path.join(tmpDir, 'test-db');
		fs.mkdirSync(dbDir, { recursive: true });
		fs.writeFileSync(path.join(dbDir, 'PG_VERSION'), '15');

		const pgVersionPath = path.join(dbDir, 'PG_VERSION');
		assert.ok(fs.existsSync(pgVersionPath), 'PG_VERSION file should exist');

		const parentDir = path.dirname(pgVersionPath);
		assert.strictEqual(parentDir, dbDir, 'Parent directory should be the database directory');
	});

	test('should parse PGlite constructor paths from source code', () => {
		const sourceFile = path.join(tmpDir, 'app.ts');
		fs.writeFileSync(
			sourceFile,
			`
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite('./my-database');
const db2 = PGlite.create('./another-db');
const memDb = new PGlite('memory://');
`
		);

		const content = fs.readFileSync(sourceFile, 'utf-8');
		const pattern = /(?:new\s+PGlite|PGlite\.create)\s*\(\s*['"`]([^'"`]+)['"`]/g;
		const matches: string[] = [];

		let match;
		while ((match = pattern.exec(content)) !== null) {
			matches.push(match[1]);
		}

		assert.strictEqual(matches.length, 3, 'Should find 3 PGlite constructor calls');
		assert.strictEqual(matches[0], './my-database');
		assert.strictEqual(matches[1], './another-db');
		assert.strictEqual(matches[2], 'memory://');
	});

	test('should filter out memory:// and idb:// paths', () => {
		const paths = ['./local-db', 'memory://', 'idb://mydb', '/absolute/db'];
		const filtered = paths.filter(
			(p) => !p.startsWith('memory://') && !p.startsWith('idb://')
		);

		assert.strictEqual(filtered.length, 2);
		assert.deepStrictEqual(filtered, ['./local-db', '/absolute/db']);
	});

	test('should resolve relative paths against source file directory', () => {
		const sourceDir = '/home/user/project/src';
		const relativePath = './data/mydb';
		const resolved = path.resolve(sourceDir, relativePath);

		assert.strictEqual(resolved, '/home/user/project/src/data/mydb');
	});

	test('should handle nested PG_VERSION discovery', () => {
		const dirs = ['db1', 'subdir/db2', 'deep/nested/db3'];
		for (const dir of dirs) {
			const fullDir = path.join(tmpDir, dir);
			fs.mkdirSync(fullDir, { recursive: true });
			fs.writeFileSync(path.join(fullDir, 'PG_VERSION'), '15');
		}

		const found: string[] = [];
		const walkDir = (dir: string) => {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					walkDir(fullPath);
				} else if (entry.name === 'PG_VERSION') {
					found.push(path.dirname(fullPath));
				}
			}
		};

		walkDir(tmpDir);
		assert.strictEqual(found.length, 3, 'Should find all 3 database directories');
	});
});
