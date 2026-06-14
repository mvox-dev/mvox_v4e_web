/**
 * Mobile overflow guard for /about.
 *
 * PaperCard on /about is fixed at width="520px", which overflows a phone
 * viewport (~375px). This test asserts no horizontal scroll at two common
 * phone widths. It must FAIL against the current code and PASS once Byrd
 * adds `max-width: 100%` (or equivalent) to PaperCard / the about page.
 *
 * Technique: compare documentElement.scrollWidth vs clientWidth inside the
 * browser — a positive delta means the page is wider than the viewport.
 */
import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
	{ label: 'iPhone SE (375×812)', width: 375, height: 812 },
	{ label: 'Android small (360×800)', width: 360, height: 800 },
];

test.describe('/about — no horizontal overflow on mobile', () => {
	for (const vp of MOBILE_VIEWPORTS) {
		test(`no horizontal overflow at ${vp.label}`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await page.goto('/about');

			// Wait for the PaperCard heading to confirm the page rendered.
			await page.waitForSelector('[data-testid="about-page-title"]');

			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);

			expect(overflow).toBeLessThanOrEqual(0);
		});
	}
});

// (*MVOX:Tallis*)
