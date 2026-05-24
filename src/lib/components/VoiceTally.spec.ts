// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import VoiceTally from './VoiceTally.svelte';

describe('VoiceTally', () => {
	it('renders a voice badge and count per entry', () => {
		const counts = { S1: 8, A: 12, B: 10 } as const;
		const { container } = render(VoiceTally, { props: { counts } });
		expect(container.textContent).toContain('S1');
		expect(container.textContent).toContain('×8');
		expect(container.textContent).toContain('A');
		expect(container.textContent).toContain('×12');
		expect(container.textContent).toContain('B');
		expect(container.textContent).toContain('×10');
	});
});
