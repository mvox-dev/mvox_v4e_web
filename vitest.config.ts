import { resolve } from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		resolve: {
			conditions: ['browser'],
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
	}),
);
