// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PencilSearch from './PencilSearch.svelte';

describe('PencilSearch', () => {
	it('renders the placeholder', () => {
		const { container } = render(PencilSearch, { props: { placeholder: 'Search…' } });
		const input = container.querySelector('input');
		expect(input?.placeholder).toBe('Search…');
	});

	it('renders the hint slot when provided', () => {
		const { container } = render(PencilSearch, { props: { placeholder: 'X', hint: '⌘K' } });
		expect(container.textContent).toContain('⌘K');
	});
});
