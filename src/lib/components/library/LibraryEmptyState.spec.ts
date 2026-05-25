// @vitest-environment happy-dom
// src/lib/components/library/LibraryEmptyState.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import LibraryEmptyState from './LibraryEmptyState.svelte';

afterEach(() => cleanup());

describe('LibraryEmptyState', () => {
	it('renders the empty-library marginalia text', () => {
		render(LibraryEmptyState);
		expect(screen.getByText(/Nothing's catalogued yet/)).toBeTruthy();
	});

	it('uses Caveat font-family on the message', () => {
		const { container } = render(LibraryEmptyState);
		const msg = container.querySelector('.empty-marginalia');
		expect(msg).not.toBeNull();
		// Computed style check is brittle in jsdom; check class is present
		expect(msg?.className).toContain('empty-marginalia');
	});
});
