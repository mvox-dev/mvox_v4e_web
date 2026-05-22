/**
 * E2E tests for CHORE-35 — frontend scaffolding (layout + landing + login shell).
 *
 * RED: all tests fail until Byrd + Josquin implement the .svelte pages.
 *
 * Auth-state simulation: set/clear the `entu_jwt` cookie before navigation.
 * BFF mock: intercept `/api/organizations` via page.route() so tests are
 * independent of a live Entu backend.
 *
 * Pinned message keys (Comenius must create these in all 4 locales):
 *   landing_signed_out_headline    — hero text shown to unauthenticated user
 *   landing_signed_out_cta         — "Sign in with Entu" button label
 *   landing_signed_in_heading      — "Your choirs" or equivalent
 *   landing_empty_state            — copy when user has zero orgs
 *   landing_error_state            — copy when BFF returns non-200
 *   landing_retry_button           — "Retry" button label
 *   nav_sign_in                    — nav link for unauthenticated state
 *   nav_sign_out                   — nav link for authenticated state
 *   auth_login_heading             — heading on /auth/login page
 *   auth_login_cta                 — "Continue with Entu" or equivalent CTA
 */
import { test, expect, type Page } from '@playwright/test';

const ORG_FIXTURES = [
	{
		_id: 'org-1',
		name: 'Tallinn Philharmonic Choir',
		description: 'Premier choral ensemble',
		location: 'Tallinn',
		photo: 'https://s3.example.com/photo-1?ttl=60',
		member_count_per_section: 12,
	},
	{
		_id: 'org-2',
		name: 'Tartu Academic Choir',
		description: 'University choir',
		location: 'Tartu',
		photo: 'https://s3.example.com/photo-2?ttl=60',
		member_count_per_section: 8,
	},
	{
		_id: 'org-3',
		name: 'Sparse Choir',
		// no description, no location, no photo, no member_count_per_section
	},
];

async function setAuthCookie(page: Page, jwt: string = 'test.jwt.token') {
	await page.context().addCookies([
		{
			name: 'entu_jwt',
			value: jwt,
			domain: 'localhost',
			path: '/',
			httpOnly: true,
			sameSite: 'Lax',
		},
	]);
}

async function clearAuthCookie(page: Page) {
	await page.context().clearCookies();
}

async function mockOrgsSuccess(page: Page, orgs = ORG_FIXTURES) {
	await page.route('/api/organizations**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ entities: orgs }),
		})
	);
}

async function mockOrgsEmpty(page: Page) {
	await page.route('/api/organizations**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ entities: [] }),
		})
	);
}

async function mockOrgsError(page: Page, status = 500) {
	await page.route('/api/organizations**', (route) =>
		route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'upstream_unavailable' }),
		})
	);
}

// ---------------------------------------------------------------------------
// Signed-out landing page
// ---------------------------------------------------------------------------

test('signed-out: landing page shows "Sign in with Entu" CTA', async ({ page }) => {
	await clearAuthCookie(page);
	await page.goto('/');

	// CTA element visible
	const cta = page.getByTestId('signed-out-cta');
	await expect(cta).toBeVisible();
});

test('signed-out: "Sign in" CTA links to /auth/login', async ({ page }) => {
	await clearAuthCookie(page);
	await page.goto('/');

	const cta = page.getByTestId('signed-out-cta');
	await expect(cta).toHaveAttribute('href', '/auth/login');
});

test('signed-out: nav shows sign-in link, not sign-out', async ({ page }) => {
	await clearAuthCookie(page);
	await page.goto('/');

	await expect(page.getByTestId('nav-sign-in')).toBeVisible();
	await expect(page.getByTestId('nav-sign-out')).not.toBeVisible();
});

test('signed-out: landing page renders without JS error', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));
	await clearAuthCookie(page);
	await page.goto('/');
	expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Auth login page
// ---------------------------------------------------------------------------

test('/auth/login: renders login page with Entu CTA', async ({ page }) => {
	await clearAuthCookie(page);
	await page.goto('/auth/login');

	// Page loads without error
	const response = await page.request.get('/auth/login');
	expect(response.status()).toBe(200);

	// Login CTA visible
	await expect(page.getByTestId('login-cta')).toBeVisible();
});

test('/auth/login: page renders without JS error', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));
	await clearAuthCookie(page);
	await page.goto('/auth/login');
	expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Signed-in landing page — orgs list
// ---------------------------------------------------------------------------

test('signed-in: shows orgs list heading, not signed-out hero', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page);
	await page.goto('/');

	// Signed-in heading visible
	await expect(page.getByTestId('orgs-heading')).toBeVisible();
	// Signed-out CTA NOT visible
	await expect(page.getByTestId('signed-out-cta')).not.toBeVisible();
});

test('signed-in: nav shows sign-out link, not sign-in', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page);
	await page.goto('/');

	await expect(page.getByTestId('nav-sign-out')).toBeVisible();
	await expect(page.getByTestId('nav-sign-in')).not.toBeVisible();
});

test('signed-in: renders 3 org cards from BFF response', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page, ORG_FIXTURES);
	await page.goto('/');

	const cards = page.getByTestId('org-card');
	await expect(cards).toHaveCount(3);
});

test('signed-in: org card shows name', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page, [ORG_FIXTURES[0]]);
	await page.goto('/');

	const card = page.getByTestId('org-card').first();
	await expect(card).toContainText('Tallinn Philharmonic Choir');
});

test('signed-in: org card shows photo img with src from _thumbnail', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page, [ORG_FIXTURES[0]]);
	await page.goto('/');

	const img = page.getByTestId('org-card').first().getByRole('img');
	await expect(img).toHaveAttribute('src', 'https://s3.example.com/photo-1?ttl=60');
});

test('signed-in: org card with no photo shows placeholder element', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page, [ORG_FIXTURES[2]]); // no photo
	await page.goto('/');

	const card = page.getByTestId('org-card').first();
	// No <img> (photo absent), but a placeholder element is present
	await expect(card.getByTestId('org-photo-placeholder')).toBeVisible();
});

test('signed-in: org card shows description when present', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsSuccess(page, [ORG_FIXTURES[0]]);
	await page.goto('/');

	const card = page.getByTestId('org-card').first();
	await expect(card).toContainText('Premier choral ensemble');
});

test.skip('signed-in: page data is SSR-present in initial HTML (no flash-of-empty)', async ({ page }) => {
	// SKIP: pending CHORE-36 (Entu mock harness) — Playwright cannot intercept SvelteKit's
	// internal event.fetch, so SSR cannot be tested today without upstream-Entu mocking.
	// Un-skip when CHORE-36 lands.
	await setAuthCookie(page);
	await mockOrgsSuccess(page, [ORG_FIXTURES[0]]);

	// Intercept the response and check the raw HTML for org name presence
	let responseBody = '';
	page.on('response', async (response) => {
		if (response.url().includes('localhost') && response.url().endsWith('/')) {
			try {
				responseBody = await response.text();
			} catch {
				// ignore
			}
		}
	});

	await page.goto('/');
	expect(responseBody).toContain('Tallinn Philharmonic Choir');
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

test('signed-in with zero orgs: shows empty-state element', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsEmpty(page);
	await page.goto('/');

	await expect(page.getByTestId('orgs-empty-state')).toBeVisible();
	await expect(page.getByTestId('org-card')).toHaveCount(0);
});

test('empty state does not show error state', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsEmpty(page);
	await page.goto('/');

	await expect(page.getByTestId('orgs-error-state')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

test('BFF 500: shows error state with retry button', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsError(page, 500);
	await page.goto('/');

	await expect(page.getByTestId('orgs-error-state')).toBeVisible();
	await expect(page.getByTestId('orgs-retry-button')).toBeVisible();
});

test('error state does not show empty state', async ({ page }) => {
	await setAuthCookie(page);
	await mockOrgsError(page, 500);
	await page.goto('/');

	await expect(page.getByTestId('orgs-empty-state')).not.toBeVisible();
});
