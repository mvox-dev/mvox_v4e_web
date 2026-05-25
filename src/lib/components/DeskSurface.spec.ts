// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DeskSurface from './DeskSurface.svelte';
import { textSnippet } from '../../tests/snippet-helpers';

describe('DeskSurface', () => {
	it('renders slot content', () => {
		const { container } = render(DeskSurface, { props: { children: textSnippet('desk content') } });
		expect(container.textContent).toContain('desk content');
	});

	it('applies the wood-bg class to the data-desk element', () => {
		const { container } = render(DeskSurface, { props: { children: textSnippet('x') } });
		const el = container.querySelector('[data-desk]');
		expect(el).not.toBeNull();
		// Svelte scopes class names; check the unscoped substring is present
		expect(el?.className).toContain('wood-bg');
	});
});
