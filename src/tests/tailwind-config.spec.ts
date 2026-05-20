/**
 * Vitest: asserts @tailwindcss/vite is registered in vite.config.ts.
 * RED: fails immediately if the package is not installed.
 * GREEN: passes once Byrd adds the plugin to vite.config.ts.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

describe('Tailwind v4 Vite plugin', () => {
	it('@tailwindcss/vite is resolvable as a package', async () => {
		// If the package is not installed this throws "Cannot find module".
		// This is the earliest possible failure signal — no build required.
		const pluginModule = await import('@tailwindcss/vite');
		expect(pluginModule.default ?? pluginModule).toBeDefined();
	});

	it('tailwindcss package is resolvable (v4 CSS-first install)', async () => {
		const tw = await import('tailwindcss');
		expect(tw).toBeDefined();
	});

	it('vite.config.ts references @tailwindcss/vite plugin', async () => {
		// Read vite.config.ts as text and confirm the import is present.
		// This is a config-integrity check — confirms Byrd wired it, not just installed it.
		const { readFile } = await import('node:fs/promises');
		const configPath = resolve(import.meta.dirname, '../../vite.config.ts');
		const src = await readFile(configPath, 'utf8');
		expect(src).toMatch(/@tailwindcss\/vite/);
	});
});
