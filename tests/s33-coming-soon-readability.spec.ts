/**
 * E2E readability test — S33 bg-rule conformance on coming-soon routes.
 * Verifies that text on /roster, /notices, /settings (DeskSurface + PaperCard)
 * sits on a coloured background, checked with getComputedStyle in a real browser.
 *
 * RED: tests fail until the three placeholder routes are built and PaperCard
 *      renders with a non-transparent background colour.
 * GREEN: tests pass when routes render with proper bg-rule backgrounds.
 */
import { test, expect } from '@playwright/test';

test.describe('Coming-soon routes — bg-rule readability', () => {
	test('roster page has readable text on PaperCard background', async ({ page }) => {
		await page.goto('/roster');

		const paperCard = page.locator('[data-testid="paper-card"]').first();
		await expect(paperCard).toBeVisible();

		const bgColor = await paperCard.evaluate((el) => window.getComputedStyle(el).backgroundColor);
		expect(bgColor).toBeTruthy();
		expect(bgColor).not.toBe('transparent');
		expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');

		const heading = paperCard.locator('h1').first();
		await expect(heading).toBeVisible();
	});

	test('notices page has readable text on PaperCard background', async ({ page }) => {
		await page.goto('/notices');

		const paperCard = page.locator('[data-testid="paper-card"]').first();
		await expect(paperCard).toBeVisible();

		const bgColor = await paperCard.evaluate((el) => window.getComputedStyle(el).backgroundColor);
		expect(bgColor).toBeTruthy();
		expect(bgColor).not.toBe('transparent');
		expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');

		const heading = paperCard.locator('h1').first();
		await expect(heading).toBeVisible();
	});

	test('settings page has readable text on PaperCard background', async ({ page }) => {
		await page.goto('/settings');

		const paperCard = page.locator('[data-testid="paper-card"]').first();
		await expect(paperCard).toBeVisible();

		const bgColor = await paperCard.evaluate((el) => window.getComputedStyle(el).backgroundColor);
		expect(bgColor).toBeTruthy();
		expect(bgColor).not.toBe('transparent');
		expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');

		const heading = paperCard.locator('h1').first();
		await expect(heading).toBeVisible();
	});
});

// (*MVOX:Tallis*)
