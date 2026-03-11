import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		extends: [...tseslint.configs.recommended],
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
		},
	},
	{
		ignores: ['dist/**', 'dist-webview/**', 'out-test/**', 'build/**', 'node_modules/**'],
	}
);
