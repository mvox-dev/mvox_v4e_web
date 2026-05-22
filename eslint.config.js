import tsParser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default [
	{
		ignores: ['src/lib/paraglide/**', '.svelte-kit/**', 'node_modules/**', 'build/**'],
	},
	{
		files: ['**/*.svelte'],
		plugins: {
			svelte: sveltePlugin,
		},
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser,
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte'],
			},
		},
		rules: {
			'svelte/valid-compile': 'error',
		},
	},
];
