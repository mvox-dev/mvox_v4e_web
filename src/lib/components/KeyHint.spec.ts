// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import KeyHint from './KeyHint.svelte';

describe('KeyHint', () => {
	it('renders key and label', () => {
		const { container } = render(KeyHint, { props: { k: '⌘K', label: 'Search' } });
		expect(container.textContent).toContain('⌘K');
		expect(container.textContent).toContain('Search');
	});

	it('renders only the key when label is omitted', () => {
		const { container } = render(KeyHint, { props: { k: 'R' } });
		expect(container.textContent?.trim()).toBe('R');
	});
});
