import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');
const distWebviewDir = path.join(__dirname, '..', 'dist-webview');

const sharedOptions = {
	bundle: true,
	minify: true,
	sourcemap: false,
	platform: 'browser',
	target: ['es2022'],
	loader: {
		'.tsx': 'tsx',
		'.ts': 'ts',
		'.ttf': 'dataurl',
		'.woff': 'dataurl',
		'.woff2': 'dataurl',
	},
};

async function main() {
	const isWatch = process.argv.includes('--watch');

	const webviewOptions = {
		...sharedOptions,
		entryPoints: [path.join(srcDir, 'webview', 'index.tsx')],
		outfile: path.join(distWebviewDir, 'webview.bundle.js'),
		format: 'iife',
		jsx: 'automatic',
	};

	if (isWatch) {
		const ctx = await esbuild.context(webviewOptions);
		await ctx.watch();
		console.log('Watching webview for changes...');
	} else {
		await esbuild.build(webviewOptions);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
