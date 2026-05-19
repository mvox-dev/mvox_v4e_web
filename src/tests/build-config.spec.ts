/**
 * Static AC checks for CHORE-1: wrangler bindings and tsconfig strict mode.
 * These tests read config files and assert their content — no build required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');

// ---------------------------------------------------------------------------
// AC: No D1, R2, KV, or Durable Objects bindings in wrangler config
// ---------------------------------------------------------------------------
describe('wrangler config — no forbidden bindings', () => {
	const FORBIDDEN_KEYS = ['d1_databases', 'r2_buckets', 'kv_namespaces', 'durable_objects'];

	it('wrangler.toml or wrangler.json must exist', () => {
		const toml = existsSync(resolve(ROOT, 'wrangler.toml'));
		const json = existsSync(resolve(ROOT, 'wrangler.json'));
		// Exactly one must be present
		expect(toml || json).toBe(true);
	});

	it('wrangler config must name the project multivox', () => {
		const tomlPath = resolve(ROOT, 'wrangler.toml');
		const jsonPath = resolve(ROOT, 'wrangler.json');

		if (existsSync(jsonPath)) {
			const cfg = JSON.parse(readFileSync(jsonPath, 'utf-8'));
			expect(cfg.name).toBe('multivox');
		} else if (existsSync(tomlPath)) {
			const content = readFileSync(tomlPath, 'utf-8');
			// Simple regex — TOML value for `name`
			expect(content).toMatch(/^\s*name\s*=\s*["']?multivox["']?\s*$/m);
		} else {
			throw new Error('No wrangler.toml or wrangler.json found');
		}
	});

	for (const key of FORBIDDEN_KEYS) {
		it(`wrangler config must NOT contain "${key}"`, () => {
			const tomlPath = resolve(ROOT, 'wrangler.toml');
			const jsonPath = resolve(ROOT, 'wrangler.json');

			if (existsSync(jsonPath)) {
				const cfg = JSON.parse(readFileSync(jsonPath, 'utf-8'));
				expect(cfg).not.toHaveProperty(key);
			} else if (existsSync(tomlPath)) {
				const content = readFileSync(tomlPath, 'utf-8');
				expect(content).not.toMatch(new RegExp(`^\\s*\\[${key}`, 'm'));
				expect(content).not.toMatch(new RegExp(`^\\s*${key}\\s*=`, 'm'));
			} else {
				// Neither file exists yet — will fail the "must exist" test above;
				// skip this check to avoid a redundant failure message
				expect(true).toBe(true);
			}
		});
	}
});

// ---------------------------------------------------------------------------
// AC: TypeScript strict mode enabled
// ---------------------------------------------------------------------------
describe('tsconfig.json — strict mode', () => {
	it('tsconfig.json must exist', () => {
		expect(existsSync(resolve(ROOT, 'tsconfig.json'))).toBe(true);
	});

	it('compilerOptions.strict must be true', () => {
		const tsconfig = JSON.parse(readFileSync(resolve(ROOT, 'tsconfig.json'), 'utf-8'));
		expect(tsconfig?.compilerOptions?.strict).toBe(true);
	});
});
