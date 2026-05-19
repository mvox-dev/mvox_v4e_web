/**
 * AC check: pnpm build produces .svelte-kit/cloudflare/ output.
 * Runs under Vitest (not Playwright) so it doesn't race with the preview server.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');

describe('cloudflare adapter build output', () => {
	it('pnpm build produces .svelte-kit/cloudflare/', { timeout: 60_000 }, () => {
		execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });
		expect(existsSync(resolve(ROOT, '.svelte-kit/cloudflare'))).toBe(true);
	});
});
