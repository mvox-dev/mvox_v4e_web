// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BrandMark from './BrandMark.svelte';

describe('BrandMark', () => {
	it('renders the m-tile and wordmark', () => {
		const { container } = render(BrandMark, { props: {} });
		expect(container.textContent).toContain('m');
		expect(container.textContent).toContain('mvox');
	});

	it('respects size variant', () => {
		const { container } = render(BrandMark, { props: { size: 'l' } });
		const wordmark = container.querySelector('[data-wordmark]');
		expect(wordmark?.className).toMatch(/text-\[22px\]/);
	});
});
