/**
 * S33 §4.3 — Playwright bg-rule gate.
 *
 * For each PUBLIC route (unauthenticated), walk the DOM and verify every visible
 * leaf text node either (a) has a non-transparent colored background somewhere in
 * its ancestor chain before reaching the .wood-bg desk surface, or (b) is exempt
 * via the data-desk-text attribute on itself or an ancestor.
 *
 * jsdom/happy-dom have no CSS layout engine and cannot resolve computed styles —
 * this MUST be Playwright (real browser). See architecture-decisions.md
 * "Responsive-layout review" for the canonical justification.
 *
 * IMPORTANT: The entire DOM walk + background-ancestor check runs inside a single
 * page.evaluate() call so element references are live in the browser context and
 * never round-tripped through a tag-name selector (which would re-find the FIRST
 * element of that tag in the document, not the actual leaf).
 *
 * Public routes: only /, /about, /auth/login.
 * /roster, /notices, /settings are auth-guarded → they 302 to /auth/login.
 * Their conformance is covered by unit tests + Bentham's backstop per the
 * hybrid-gate design (spec §4.3).
 *
 * Negative control: injects bare text nodes directly on the desk element and
 * asserts the check correctly identifies them as violations.
 */
import { test, expect } from '@playwright/test';

/**
 * Routes that can render without authentication.
 * Do NOT add /roster, /notices, /settings here — they are auth-guarded and
 * redirect to /auth/login, so listing them would re-test the login page.
 */
const PUBLIC_ROUTES = ['/', '/about', '/auth/login'];

/** Violation record produced by the in-browser walk. */
interface Violation {
	/** Human-readable path for reporting (tag + nth-index + text snippet). */
	path: string;
	/** First 80 chars of the element's text content. */
	text: string;
}

/**
 * Walk the DOM entirely inside the browser context so element references stay
 * live — no round-trip through a CSS selector. Returns violations: leaf text
 * nodes that have no colored-bg ancestor before .wood-bg and are not exempt via
 * data-desk-text.
 */
async function findViolations(page: import('@playwright/test').Page): Promise<Violation[]> {
	return page.evaluate(() => {
		const excluded = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'TITLE', 'META']);
		const violations: Array<{ path: string; text: string }> = [];

		/**
		 * Build a descriptive path for reporting: tag + index among siblings of
		 * same tag + truncated text. e.g. "span[3]: «mvox is the back-of-hou…»"
		 */
		function describeEl(el: Element): string {
			const tag = el.tagName.toLowerCase();
			const siblings = Array.from(el.parentElement?.children ?? []).filter(
				(c) => c.tagName === el.tagName,
			);
			const idx = siblings.indexOf(el);
			const text = (el.textContent ?? '').trim().slice(0, 50);
			return `${tag}[${idx}]: «${text}»`;
		}

		/**
		 * FIX A — Parse rgba alpha channel correctly.
		 * Returns true only when the background-color is genuinely opaque (alpha > 0).
		 * Rejects 'transparent', 'rgba(0,0,0,0)', and any rgba() with alpha ≤ 0
		 * (e.g. rgba(251,249,243,0) which the old string-match would false-pass).
		 * rgb() and named colors are counted as opaque (no alpha channel = fully opaque).
		 */
		function isOpaqueColor(bg: string): boolean {
			if (!bg || bg === 'transparent') return false;
			// rgba(r,g,b,a) — parse the alpha component
			const rgbaMatch = bg.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
			if (rgbaMatch) {
				const alpha = parseFloat(rgbaMatch[1]);
				return alpha > 0;
			}
			// rgb(r,g,b) — fully opaque by definition
			if (bg.startsWith('rgb(')) return true;
			// Named colors, hex values — treat as opaque
			if (bg !== 'transparent') return true;
			return false;
		}

		/**
		 * Check whether this element or any ancestor carries data-desk-text, or has
		 * an opaque background-color before reaching the .wood-bg desk surface.
		 *
		 * Conformance rule: only an opaque background-color counts. background-image is
		 * NOT used as an independent conformance signal (Fix D tightened, YELLOW-33.3):
		 * a transparent gradient has background-image !== 'none' but zero coverage.
		 * All real conforming elements in mvox carry an explicit background-color; any
		 * that paint via an image/gradient also declare a fallback color.
		 *
		 * The .wood-bg stop fires BEFORE we inspect that element's own styles, so the
		 * desk gradient is never evaluated as a conforming background.
		 */
		function hasBgOrExemption(el: Element): boolean {
			let current: Element | null = el;
			while (current) {
				// Stop at the desk surface — reached .wood-bg without finding bg → bare on desk.
				// This fires BEFORE we check .wood-bg's own background-image, so the desk
				// gradient cannot false-pass as a conforming ancestor background.
				if (current.classList.contains('wood-bg')) return false;
				// Explicit exemption via data-desk-text on this element or any ancestor
				if (current.hasAttribute('data-desk-text')) return true;
				const style = window.getComputedStyle(current);
				// FIX A — opaque background-color is the primary conformance signal
				if (isOpaqueColor(style.backgroundColor)) return true;
				// FIX D (tightened) — background-image is NOT counted as an independent
				// conformance signal. Only an opaque background-color (checked above) counts.
				// Reason: a transparent/decorative gradient (e.g. linear-gradient(transparent,
				// transparent)) has background-image !== 'none' but provides zero coverage.
				// All conforming elements in the mvox design carry an explicit background-color;
				// relying on background-image alone would admit false passes.
				// Image/gradient coverage is handled implicitly: if an element's background-image
				// makes it visually opaque AND it was designed to provide coverage, it should also
				// declare a fallback background-color — which isOpaqueColor catches above.
				current = current.parentElement;
			}
			return false;
		}

		/**
		 * Describe a TEXT_NODE for violation reporting.
		 * FIX C — text nodes don't have tagName/children; use the parent element
		 * as the reference with a "text#N" suffix to distinguish text-node siblings.
		 */
		function describeTextNode(node: Text): string {
			const parent = node.parentElement;
			if (!parent) return `text: «${(node.textContent ?? '').trim().slice(0, 50)}»`;
			const tag = parent.tagName.toLowerCase();
			const siblings = Array.from(parent.parentElement?.children ?? []).filter(
				(c) => c.tagName === parent.tagName,
			);
			const parentIdx = siblings.indexOf(parent);
			const text = (node.textContent ?? '').trim().slice(0, 50);
			return `${tag}[${parentIdx}]#text: «${text}»`;
		}

		/** Recursive DOM walk. */
		function walk(el: Element) {
			if (excluded.has(el.tagName)) return;

			if (el.children.length === 0) {
				// Pure leaf element — check the element itself
				const text = (el.textContent ?? '').trim();
				if (text.length > 0 && text.length < 300) {
					if (!hasBgOrExemption(el)) {
						violations.push({ path: describeEl(el), text: text.slice(0, 80) });
					}
				}
			} else {
				// FIX C — also check direct TEXT_NODE children of mixed-content elements.
				// These are bare text strings sitting directly inside an element that also
				// has child elements (e.g. <p>Hello <strong>world</strong></p> — "Hello "
				// is a TEXT_NODE that the element-only walk would silently skip).
				for (const node of el.childNodes) {
					if (node.nodeType === Node.TEXT_NODE) {
						const text = (node.textContent ?? '').trim();
						if (text.length > 0 && text.length < 300) {
							// The text node inherits its parent element's ancestry for the bg check
							if (!hasBgOrExemption(el)) {
								violations.push({
									path: describeTextNode(node as Text),
									text: text.slice(0, 80),
								});
							}
						}
					}
				}
				// Recurse into child elements
				for (const child of el.children) walk(child);
			}
		}

		// Cap at 60 violations to avoid flooding the output on badly-broken routes.
		// The walk processes all nodes; we just truncate reporting.
		walk(document.body);
		return violations.slice(0, 60);
	});
}

for (const route of PUBLIC_ROUTES) {
	test(`${route} — all leaf text nodes sit on colored bg or carry data-desk-text`, async ({
		page,
	}) => {
		await page.goto(route);
		await page.waitForLoadState('networkidle');

		const violations = await findViolations(page);

		if (violations.length > 0) {
			const list = violations
				.slice(0, 10)
				.map((v) => `  ${v.path}: "${v.text}"`)
				.join('\n');
			throw new Error(
				`${route}: ${violations.length} bare-text-on-desk violation(s) (first 10):\n${list}`,
			);
		}
	});
}

// Negative control: bare text injected directly onto .wood-bg must be detected
// as violations. Validates the check itself works correctly including Fix A + Fix B.
test('negative control — injected bare text node is detected as violation', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// Inject a bare opaque span directly onto the desk surface
	const injected = await page.evaluate(() => {
		const desk = document.querySelector('.wood-bg');
		if (!desk) return false;
		const span = document.createElement('span');
		span.setAttribute('data-testid', 'injected-bare-text');
		span.textContent = 'BARE TEXT VIOLATION';
		desk.appendChild(span);
		return true;
	});
	expect(injected).toBe(true);

	// Run the full violation walk — injected element must appear as a violation
	const violations = await findViolations(page);
	const injectedViolation = violations.find((v) => v.text.includes('BARE TEXT VIOLATION'));
	expect(injectedViolation).toBeDefined();
});

// FIX B — Transparent rgba guard: rgba(r,g,b,0) must NOT pass as a colored bg.
// This directly guards Fix A from regressing — if isOpaqueColor is broken and
// accepts alpha=0, a transparently-backgrounded element would escape detection.
test('negative control — transparent rgba background is NOT counted as colored bg', async ({
	page,
}) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// Inject a span with an explicit transparent rgba background onto the desk surface.
	// The alpha channel is 0 — this must still be detected as a violation.
	const injected = await page.evaluate(() => {
		const desk = document.querySelector('.wood-bg');
		if (!desk) return false;
		const span = document.createElement('span');
		span.setAttribute('data-testid', 'injected-transparent-rgba');
		span.textContent = 'TRANSPARENT RGBA VIOLATION';
		// Explicit transparent background — rgb values non-zero but alpha = 0
		span.style.backgroundColor = 'rgba(100, 100, 100, 0)';
		desk.appendChild(span);
		return true;
	});
	expect(injected).toBe(true);

	// This span must still be reported as a violation — alpha=0 is transparent
	const violations = await findViolations(page);
	const transparentViolation = violations.find((v) =>
		v.text.includes('TRANSPARENT RGBA VIOLATION'),
	);
	expect(transparentViolation).toBeDefined();
});

// YELLOW-33.3 (tightened) — Fix-D transparent/decorative gradient guard.
// Fix D originally counted ANY background-image !== 'none' as conformance. A fully-
// transparent gradient (linear-gradient(transparent, transparent)) has no visual
// coverage but would have false-passed. Fix D is now retired: background-image is not
// used as an independent conformance signal at all. Only opaque background-color counts.
// This negative control verifies the tightened behavior: a transparent-gradient-only
// element on the desk is correctly flagged as a violation.
test('negative control — transparent gradient background-image is NOT counted as colored bg', async ({
	page,
}) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// Inject a span with a fully-transparent gradient directly on the desk.
	// background-image is set (non 'none'), but it provides zero coverage.
	const injected = await page.evaluate(() => {
		const desk = document.querySelector('.wood-bg');
		if (!desk) return false;
		const span = document.createElement('span');
		span.setAttribute('data-testid', 'injected-transparent-gradient');
		span.textContent = 'TRANSPARENT GRADIENT VIOLATION';
		// Transparent gradient — has a background-image, but no actual color
		span.style.backgroundImage = 'linear-gradient(transparent, transparent)';
		span.style.backgroundColor = 'transparent';
		desk.appendChild(span);
		return true;
	});
	expect(injected).toBe(true);

	// The injected element must be reported as a violation.
	// If Fix D is too broad (counts all background-image as conformance), this fails.
	const violations = await findViolations(page);
	const gradientViolation = violations.find((v) =>
		v.text.includes('TRANSPARENT GRADIENT VIOLATION'),
	);
	expect(gradientViolation).toBeDefined();
});

// (*MVOX:Tallis*)
