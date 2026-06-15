/**
 * SSR-safety guard for /invite/[token] landing page.
 *
 * Regression: a top-level $derived read localStorage (getToken()) during SSR
 * and caused a 500. happy-dom unit tests passed because they only exercise the
 * client path. This Playwright spec hits the real SSR render path.
 *
 * Token encoding: base64url(JSON.stringify(payload)) — mirrors encodeInviteToken
 * inlined here to avoid $lib alias resolution issues in the preview build context.
 */
import { test, expect } from '@playwright/test';

function encodeToken(payload: object): string {
	return Buffer.from(JSON.stringify(payload))
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

const validPayload = {
	orgId: 'org-ssr-test',
	orgName: 'Eesti Filharmoonia Kammerkoor',
	inviterPersonId: 'p-ssr-admin',
	sections: [],
	exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
};

test('valid token: SSR renders 200 and invite-heading with orgName', async ({ page }) => {
	const token = encodeToken(validPayload);
	const response = await page.goto(`/invite/${token}`);

	// Must not 500 — the SSR-bug guard
	expect(response?.status()).toBe(200);

	// invite-heading must be visible and contain the org name
	const heading = page.getByTestId('invite-heading');
	await expect(heading).toBeVisible();
	await expect(heading).toContainText('Eesti Filharmoonia Kammerkoor');
});

test('malformed token: SSR renders 200 and invite-invalid (not 500)', async ({ page }) => {
	const response = await page.goto('/invite/garbage');

	// Also must not 500 — malformed token handled gracefully by SSR guard
	expect(response?.status()).toBe(200);

	const invalid = page.getByTestId('invite-invalid');
	await expect(invalid).toBeVisible();
});
