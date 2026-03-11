import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 30000,
	});

	const testsRoot = path.resolve(__dirname);

	return new Promise((resolve, reject) => {
		const files = fs.readdirSync(testsRoot);
		const testFiles = files.filter((f) => f.endsWith('.test.js'));

		testFiles.forEach((f) => {
			mocha.addFile(path.resolve(testsRoot, f));
		});

		try {
			mocha.run((failures) => {
				if (failures > 0) {
					reject(new Error(`${failures} tests failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}
