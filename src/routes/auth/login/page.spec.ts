import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// RED: the login page must import safeRedirectTarget from the client-safe shared
// location (src/lib/auth/redirect.ts) instead of inlining the open-redirect check.
// Source-level assertion avoids the heavy mock burden of mounting +page.svelte.

const LOGIN_PAGE_SRC = readFileSync(
	resolve(import.meta.dirname, '+page.svelte'),
	'utf-8',
);

describe('login page — open-redirect deduplication (#80)', () => {
	it('imports safeRedirectTarget from the client-safe shared util', () => {
		// Must import from $lib/auth/redirect (not server path, not inline)
		expect(LOGIN_PAGE_SRC).toMatch(/import\s.*safeRedirectTarget.*from\s+['"][$\w/.-]*auth\/redirect['"]/);
	});

	it('does NOT inline the open-redirect guard logic', () => {
		// The old inline guard: raw.startsWith('/') && !raw.startsWith('//')
		// If this match is still present the DRY refactor is incomplete.
		expect(LOGIN_PAGE_SRC).not.toMatch(/startsWith\(['"]\/['"]\)\s*&&\s*!.*startsWith\(['"]\/{2}['"]\)/);
	});
});

// (*MVOX:Tallis*)
