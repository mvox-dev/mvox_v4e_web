// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach, vi } from 'vitest';
import LandingFooter from './LandingFooter.svelte';

const { setLanguageTagSpy } = vi.hoisted(() => ({ setLanguageTagSpy: vi.fn() }));
vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: setLanguageTagSpy,
	languageTag: () => 'en',
}));

afterEach(() => {
	cleanup();
	setLanguageTagSpy.mockClear();
});

describe('LandingFooter', () => {
	it('renders brand mark + tagline + 4 links + 4 locale chips + micro line', () => {
		const { container } = render(LandingFooter);
		expect(container.textContent).toContain('mvox');
		expect(container.textContent).toContain('back-of-house for your choir');
		expect(container.textContent).toContain('About mvox');
		expect(container.textContent).toContain('Open infrastructure');
		expect(container.textContent).toContain('Contact: hello@mvox.eu');
		expect(container.textContent).toContain('github.com/mvox-dev');
		expect(container.textContent).toContain('© 2026');
		expect(container.textContent).toContain('v4E · invite-only');
	});

	it('renders all 4 locale chips with EN marked active', () => {
		const { container } = render(LandingFooter);
		const chips = container.querySelectorAll('button[data-testid^="locale-chip-"]');
		expect(chips.length).toBe(4);
		const active = container.querySelector('button[data-testid="locale-chip-en"]');
		expect(active?.classList.contains('bg-paper')).toBe(true);
	});

	it('clicking a locale chip calls setLanguageTag()', async () => {
		const { container } = render(LandingFooter);
		const etChip = container.querySelector(
			'button[data-testid="locale-chip-et"]',
		) as HTMLButtonElement;
		etChip.click();
		expect(setLanguageTagSpy).toHaveBeenCalledWith('et');
	});

	it('external links open in a new tab with rel=noopener noreferrer', () => {
		const { container } = render(LandingFooter);
		const sourceLink = container.querySelector('a[href^="https://github.com"]');
		expect(sourceLink?.getAttribute('target')).toBe('_blank');
		expect(sourceLink?.getAttribute('rel')).toContain('noopener');
	});
});
