import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SPEC_DIR = import.meta.dirname;
const REPO_ROOT = resolve(SPEC_DIR, '../../../..');

describe('callback +page.server.ts — uses $env/static/public, not $env/dynamic/private', () => {
	const source = readFileSync(resolve(SPEC_DIR, '+page.server.ts'), 'utf-8');

	it('does not import from $env/dynamic/private', () => {
		expect(source).not.toContain('$env/dynamic/private');
	});

	it('does not reference env.ENTU_DB', () => {
		expect(source).not.toContain('env.ENTU_DB');
	});

	it('imports from $env/static/public', () => {
		expect(source).toContain('$env/static/public');
	});

	it('references PUBLIC_ENTU_DB', () => {
		expect(source).toContain('PUBLIC_ENTU_DB');
	});
});

describe('wrangler.json — ENTU_DB dead var removed, PUBLIC_ENTU_DB preserved', () => {
	const wrangler = JSON.parse(readFileSync(resolve(REPO_ROOT, 'wrangler.json'), 'utf-8'));

	it('does not contain ENTU_DB in vars', () => {
		expect(wrangler.vars?.ENTU_DB).toBeUndefined();
	});

	it('preserves PUBLIC_ENTU_DB with value polyphony', () => {
		expect(wrangler.vars?.PUBLIC_ENTU_DB).toBe('polyphony');
	});
});
