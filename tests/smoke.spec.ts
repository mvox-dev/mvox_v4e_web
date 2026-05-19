/**
 * Smoke E2E tests for CHORE-1 bootstrap AC.
 * Build-output assertion lives in src/tests/build-output.spec.ts (Vitest)
 * so it doesn't race with this file's Playwright preview server.
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// AC: root route renders without error
// ---------------------------------------------------------------------------
test('root route renders without JS error', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));

	await page.goto('/');

	// The page should return 200 (not 404 or 500)
	const response = await page.request.get('/');
	expect(response.status()).toBe(200);

	// No uncaught JS errors
	expect(errors).toHaveLength(0);
});
