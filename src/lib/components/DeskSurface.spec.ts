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

	it('inlines the repeating-linear-gradient wood-grain', () => {
		const { container } = render(DeskSurface, { props: { children: textSnippet('x') } });
		const el = container.querySelector('[data-desk]');
		const style = el?.getAttribute('style') || '';
		expect(style).toContain('repeating-linear-gradient');
		expect(style).toContain('110deg');
	});
});
