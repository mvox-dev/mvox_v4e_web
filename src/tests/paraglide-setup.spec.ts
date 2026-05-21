/**
 * Vitest: static AC checks for CHORE-3 — Paraglide i18n setup.
 *
 * RED: all tests fail until Byrd installs @inlang/paraglide-sveltekit,
 * configures the Vite plugin, creates the 4 locale files, and adds the
 * gitignore entry for the generated src/lib/paraglide/ directory.
 *
 * GREEN: tests pass once those files are in place.
 *
 * Out of scope: server-side locale detection, locale routing, message key
 * content (Comenius adds keys in the i18n phase), and Cloudflare deploy config.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

// ---------------------------------------------------------------------------
// AC 1: @inlang/paraglide-sveltekit declared in package.json
// ---------------------------------------------------------------------------
describe('package.json — @inlang/paraglide-sveltekit dependency', () => {
	it('@inlang/paraglide-sveltekit is declared in dependencies or devDependencies', () => {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
		const allDeps = {
			...(pkg.dependencies ?? {}),
			...(pkg.devDependencies ?? {})
		};
		expect(Object.keys(allDeps)).toContain('@inlang/paraglide-sveltekit');
	});

	it('@inlang/paraglide-sveltekit package is resolvable (installed in node_modules)', async () => {
		// Throws "Cannot find module" if the package is missing — earliest failure signal.
		const mod = await import('@inlang/paraglide-sveltekit');
		expect(mod).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// AC 2: Paraglide Vite plugin wired into vite.config.ts
// ---------------------------------------------------------------------------
describe('vite.config.ts — Paraglide plugin present', () => {
	it('vite.config.ts imports from @inlang/paraglide-sveltekit/vite', () => {
		const src = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf-8');
		expect(src).toMatch(/@inlang\/paraglide-sveltekit/);
	});

	it('vite.config.ts includes the paraglide plugin in the plugins array', () => {
		const src = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf-8');
		// Must call paraglide() (or similar) inside the plugins array.
		// A literal match for the function call confirms it was registered, not just imported.
		expect(src).toMatch(/paraglide\s*\(/);
	});
});

// ---------------------------------------------------------------------------
// AC 3: All 4 locale files exist and contain valid JSON
// ---------------------------------------------------------------------------
describe.each([
	['en'],
	['et'],
	['lv'],
	['uk']
])('messages/%s.json', (locale) => {
	it(`messages/${locale}.json exists`, () => {
		expect(existsSync(resolve(ROOT, `messages/${locale}.json`))).toBe(true);
	});

	it(`messages/${locale}.json parses as valid JSON`, () => {
		const content = readFileSync(resolve(ROOT, `messages/${locale}.json`), 'utf-8');
		expect(() => JSON.parse(content)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// AC 4: Generated src/lib/paraglide/ directory is gitignored
// ---------------------------------------------------------------------------
describe('.gitignore — src/lib/paraglide/ is ignored', () => {
	it('.gitignore contains an entry covering src/lib/paraglide/', () => {
		const gitignore = readFileSync(resolve(ROOT, '.gitignore'), 'utf-8');
		const lines = gitignore.split('\n').map((l) => l.trim());
		// Accept with or without trailing slash; strip leading slash if present.
		// Any line that would match the generated directory path counts.
		const matches = lines.filter((l) => {
			if (l.startsWith('#') || l === '') return false;
			// Normalise the line for comparison: strip a leading slash if present.
			const normalised = l.replace(/^\//, '');
			return (
				normalised === 'src/lib/paraglide' ||
				normalised === 'src/lib/paraglide/'
			);
		});
		expect(matches.length).toBeGreaterThan(0);
	});
});
