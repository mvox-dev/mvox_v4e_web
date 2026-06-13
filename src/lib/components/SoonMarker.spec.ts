// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SoonMarker from './SoonMarker.svelte';

afterEach(cleanup);

describe('SoonMarker', () => {
	it('renders "soon" text', () => {
		const { container } = render(SoonMarker);
		const marker = container.querySelector('[data-testid="soon-marker"]');
		expect(marker).not.toBeNull();
		expect(marker?.textContent?.toLowerCase()).toContain('soon');
	});

	it('uses font-display (Caveat script) class', () => {
		const { container } = render(SoonMarker);
		const marker = container.querySelector('[data-testid="soon-marker"]');
		expect(marker?.className).toContain('font-display');
	});

	it('applies amber color via text-amber class', () => {
		const { container } = render(SoonMarker);
		const marker = container.querySelector('[data-testid="soon-marker"]');
		expect(marker?.className).toContain('text-amber');
	});

	it('applies rotate(-6deg) via -rotate-6 class', () => {
		const { container } = render(SoonMarker);
		const marker = container.querySelector('[data-testid="soon-marker"]');
		expect(marker?.className).toContain('-rotate-6');
	});

	it('is inline-block sized for tab inline layout', () => {
		const { container } = render(SoonMarker);
		const marker = container.querySelector('[data-testid="soon-marker"]');
		expect(marker?.className).toContain('inline-block');
	});

	it('is marked aria-hidden (decorative)', () => {
		const { container } = render(SoonMarker);
		const marker = container.querySelector('[data-testid="soon-marker"]');
		expect(marker?.getAttribute('aria-hidden')).toBe('true');
	});
});

// (*MVOX:Tallis*)
