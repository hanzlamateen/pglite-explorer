import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

const sharedOptions = {
	bundle: true,
	external: ['vscode'],
	sourcemap: true,
};

async function main() {
	const isWatch = process.argv.includes('--watch');
	const isProduction = process.argv.includes('--production');

	const extensionOptions = {
		...sharedOptions,
		entryPoints: [path.join(srcDir, 'extension', 'index.ts')],
		outfile: path.join(distDir, 'extension.js'),
		format: 'cjs',
		platform: 'node',
		minify: isProduction,
		sourcemap: !isProduction,
	};

	if (isWatch) {
		const ctx = await esbuild.context(extensionOptions);
		await ctx.watch();
		console.log('Watching extension for changes...');
	} else {
		await esbuild.build(extensionOptions);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
