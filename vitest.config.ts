import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'$app/navigation': resolve('./src/tests/mocks/app-navigation.ts'),
		},
	},
	test: {
		include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
		environment: 'node',
		globals: false,
		setupFiles: ['src/tests/setup.ts'],
	},
});
