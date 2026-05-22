import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');

// ---------------------------------------------------------------------------
// AC: package.json deploy script
// ---------------------------------------------------------------------------
describe('package.json — deploy script', () => {
	const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

	it('deploy script exists with the exact name "deploy"', () => {
		expect(pkg.scripts).toHaveProperty('deploy');
	});

	it('deploy script invokes wrangler', () => {
		const script: string = pkg.scripts?.deploy ?? '';
		expect(script).toMatch(/wrangler/);
	});

	it('deploy script references the SvelteKit Cloudflare adapter output dir', () => {
		const script: string = pkg.scripts?.deploy ?? '';
		expect(script).toMatch(/\.svelte-kit\/cloudflare/);
	});
});

// ---------------------------------------------------------------------------
// AC: wrangler.json shape
// (wrangler.json is already asserted to exist in build-config.spec.ts;
//  these tests assert deploy-specific fields)
// ---------------------------------------------------------------------------
describe('wrangler.json — deploy configuration', () => {
	it('wrangler.json exists at repo root', () => {
		expect(existsSync(resolve(ROOT, 'wrangler.json'))).toBe(true);
	});

	it('wrangler.json declares name "multivox"', () => {
		const cfg = JSON.parse(readFileSync(resolve(ROOT, 'wrangler.json'), 'utf-8'));
		expect(cfg.name).toBe('multivox');
	});

	it('wrangler.json points pages_build_output_dir at adapter output', () => {
		const cfg = JSON.parse(readFileSync(resolve(ROOT, 'wrangler.json'), 'utf-8'));
		expect(cfg.pages_build_output_dir).toBe('.svelte-kit/cloudflare');
	});

	it('wrangler.json does not contain account_id', () => {
		const content = readFileSync(resolve(ROOT, 'wrangler.json'), 'utf-8');
		const cfg = JSON.parse(content);
		expect(cfg).not.toHaveProperty('account_id');
	});

	it('wrangler.json does not contain any API token or secret', () => {
		const content = readFileSync(resolve(ROOT, 'wrangler.json'), 'utf-8');
		// Tokens look like CF API keys: 40-char hex/alphanumeric strings
		// Guard against accidentally committed CF token or API key value
		expect(content).not.toMatch(/CLOUDFLARE_API_TOKEN/i);
		expect(content).not.toMatch(/CF_API_TOKEN/i);
		expect(content).not.toMatch(/api_token/i);
	});
});
