/**
 * E2E smoke test for the full OAuth login flow.
 *
 * SKIPPED pending issue #36 — mock Entu harness for Playwright.
 * The full OAuth flow requires either:
 *   a) A live Entu test database + real OAuth provider (not feasible in CI)
 *   b) A recorded-response fixture layer intercepting api.entu.app calls
 *
 * When #36 mock harness lands, remove `.skip` and implement the body.
 *
 * Pinned message keys (Comenius must create in all 4 locales):
 *   auth_login_heading         — heading on /auth/login
 *   auth_login_provider_label  — per-provider button label (e.g. "Sign in with Google")
 *   auth_callback_loading      — "Signing you in..." shown during client-side exchange
 */
import { test, expect } from '@playwright/test';

test.describe
	.skip('OAuth login flow (pending #36 mock harness)', () => {
		test('unauthenticated user sees provider buttons on /auth/login', async ({ page }) => {
			await page.goto('/auth/login');

			// All 6 providers rendered
			const providerLinks = page.locator('[data-testid^="provider-"]');
			await expect(providerLinks).toHaveCount(6);
		});

		test('provider buttons link to api.entu.app/auth/{provider}', async ({ page }) => {
			await page.goto('/auth/login');

			const firstLink = page.locator('[data-testid="provider-google"]');
			const href = await firstLink.getAttribute('href');
			expect(href).toContain('entu.app/auth/google');
		});

		test('happy path: callback page exchanges session token, sets cookie, navigates to /', async ({
			page,
			context,
		}) => {
			// #36: intercept api.entu.app/{db}/auth to return a fake JWT
			// #36: intercept /auth/cookie to set a fake cookie
			// Then visit /auth/callback?state=<csrf>&key=<token>

			// Placeholder — implement when mock harness lands
			await page.goto('/auth/callback?state=mock_csrf&key=mock_token');

			// After exchange, should land at / with signed-in state
			await expect(page).toHaveURL('/');
		});

		test('callback page shows error and redirects to /auth/login on exchange failure', async ({
			page,
		}) => {
			// #36: intercept api.entu.app to return 401

			await page.goto('/auth/callback?state=mock_csrf&key=bad_token');

			await expect(page).toHaveURL(/\/auth\/login/);
		});

		test('logout clears session and returns to /', async ({ page, context }) => {
			// #36: start with a seeded entu_jwt cookie
			await context.addCookies([
				{
					name: 'entu_jwt',
					value: 'mock.jwt.token',
					domain: 'localhost',
					path: '/',
				},
			]);

			await page.goto('/');

			// Trigger logout (data-testid="nav-sign-out" submits the logout form)
			await page.click('[data-testid="nav-sign-out"]');

			await expect(page).toHaveURL('/');
			// Cookie should be cleared
			const cookies = await context.cookies();
			expect(cookies.find((c) => c.name === 'entu_jwt')).toBeUndefined();
		});
	});
