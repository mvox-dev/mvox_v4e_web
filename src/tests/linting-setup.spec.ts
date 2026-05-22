/**
 * Vitest: static AC checks for CHORE-48 — ESLint + Biome dual-tool linting setup.
 *
 * RED: all tests fail until Josquin installs @biomejs/biome + eslint-plugin-svelte,
 * creates biome.json + eslint.config.js, and adds lint/lint:fix scripts to package.json.
 *
 * GREEN: tests pass once those files and deps are in place.
 *
 * Camp B pattern: filesystem + package.json assertions only — no subprocess calls.
 * Matches src/tests/build-config.spec.ts and src/tests/paraglide-setup.spec.ts.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

// ---------------------------------------------------------------------------
// AC 1: biome.json exists at repo root
// ---------------------------------------------------------------------------
describe('biome.json — Biome config present', () => {
	it('biome.json exists at repo root', () => {
		expect(existsSync(resolve(ROOT, 'biome.json'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// AC 2: @biomejs/biome declared in devDependencies
// ---------------------------------------------------------------------------
describe('package.json — @biomejs/biome devDependency', () => {
	it('@biomejs/biome is declared in devDependencies', () => {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
		expect(Object.keys(pkg.devDependencies ?? {})).toContain('@biomejs/biome');
	});
});

// ---------------------------------------------------------------------------
// AC 3: eslint.config.js exists at repo root
// ---------------------------------------------------------------------------
describe('eslint.config.js — ESLint config present', () => {
	it('eslint.config.js exists at repo root', () => {
		expect(existsSync(resolve(ROOT, 'eslint.config.js'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// AC 4: eslint-plugin-svelte declared in devDependencies
// ---------------------------------------------------------------------------
describe('package.json — eslint-plugin-svelte devDependency', () => {
	it('eslint-plugin-svelte is declared in devDependencies', () => {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
		expect(Object.keys(pkg.devDependencies ?? {})).toContain('eslint-plugin-svelte');
	});

	it('svelte-eslint-parser is declared in devDependencies', () => {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
		expect(Object.keys(pkg.devDependencies ?? {})).toContain('svelte-eslint-parser');
	});
});

// ---------------------------------------------------------------------------
// AC 5: lint + lint:fix scripts in package.json
// ---------------------------------------------------------------------------
describe('package.json — lint scripts', () => {
	it('package.json has a "lint" script', () => {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
		expect(pkg.scripts).toHaveProperty('lint');
	});

	it('package.json has a "lint:fix" script', () => {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
		expect(pkg.scripts).toHaveProperty('lint:fix');
	});
});
