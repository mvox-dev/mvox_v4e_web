/**
 * Tailwind v4 setup smoke tests — CHORE-2 AC.
 *
 * RED: both tests fail until Byrd installs tailwindcss + @tailwindcss/vite,
 * adds `@import "tailwindcss"` to app.css, and places a known utility class
 * on the root page element.
 *
 * GREEN: tests pass once Tailwind v4 is configured and the utility class
 * produces the expected computed style.
 *
 * Why Playwright (not Vitest) for the style assertion: computed CSS values
 * can only be verified in a real browser — a DOM-less Vitest test cannot
 * confirm that the stylesheet was generated and applied correctly.
 */
import { test, expect } from '@playwright/test';

// The class Byrd must place on at least one visible element on the root page.
// Tailwind v4 uses OKLCH color space natively (v3 used RGB); Chromium reports oklch strings.
const TAILWIND_CLASS = 'text-blue-500';
const EXPECTED_COLOR = 'oklch(0.623 0.214 259.815)';

test('Tailwind utility class produces correct computed color', async ({ page }) => {
	await page.goto('/');

	// Byrd must add an element with class="text-blue-500" (or data-testid) on the page.
	// The locator here looks for any element carrying the utility class.
	const el = page.locator(`.${TAILWIND_CLASS}`).first();
	await expect(el).toBeVisible();

	const color = await el.evaluate((node) =>
		window.getComputedStyle(node).color
	);
	expect(color).toBe(EXPECTED_COLOR);
});

test('Tailwind base styles are applied (body margin reset)', async ({ page }) => {
	await page.goto('/');

	// Tailwind v4's preflight resets body margin to 0.
	// This fails before Tailwind is configured because browsers default to 8px margin.
	const margin = await page.evaluate(() =>
		window.getComputedStyle(document.body).margin
	);
	expect(margin).toBe('0px');
});
