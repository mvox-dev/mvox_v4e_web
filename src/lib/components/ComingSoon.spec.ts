// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	page_coming_soon_label: () => 'Coming soon',
	page_coming_soon_back_to_agenda: () => 'Back to Agenda',
}));

import ComingSoon from './ComingSoon.svelte';

afterEach(cleanup);

describe('ComingSoon', () => {
	const defaultProps = {
		label: 'Choir management',
		name: 'Roster',
		description: 'See who sings in your choir.',
		backHref: '/agenda',
	};

	it('renders label, name, description, and coming-soon message', () => {
		const { container } = render(ComingSoon, { props: defaultProps });
		expect(container.textContent).toContain('Choir management');
		expect(container.textContent).toContain('Roster');
		expect(container.textContent).toContain('See who sings in your choir.');
		expect(container.textContent?.toLowerCase()).toContain('soon');
	});

	it('includes back link with provided href', () => {
		const { container } = render(ComingSoon, { props: defaultProps });
		const backLink = container.querySelector('a[href="/agenda"]');
		expect(backLink).not.toBeNull();
		expect(backLink?.textContent?.toLowerCase()).toContain('back');
	});

	it('renders label in small uppercase eyebrow style', () => {
		const { container } = render(ComingSoon, {
			props: { ...defaultProps, label: 'Test Label' },
		});
		const label = container.querySelector('[data-testid="coming-soon-label"]');
		expect(label).not.toBeNull();
		expect(label?.className).toContain('uppercase');
		expect(label?.textContent).toContain('Test Label');
	});

	it('renders inside a PaperCard', () => {
		const { container } = render(ComingSoon, { props: defaultProps });
		const paperCard = container.querySelector('[data-testid="paper-card"]');
		expect(paperCard).not.toBeNull();
	});
});

// (*MVOX:Tallis*)
