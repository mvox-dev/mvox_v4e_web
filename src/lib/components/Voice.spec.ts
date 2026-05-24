// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Voice from './Voice.svelte';

describe('Voice', () => {
	it('renders the voice label', () => {
		const { container } = render(Voice, { props: { v: 'S1' } });
		expect(container.textContent).toContain('S1');
	});

	it('applies voice-family class based on first character', () => {
		const { container } = render(Voice, { props: { v: 'B2' } });
		const el = container.querySelector('span');
		expect(el?.className).toMatch(/bg-voice-b/);
	});
});
