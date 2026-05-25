// @vitest-environment happy-dom
// src/lib/components/library/LibraryWorkPaperStack.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import LibraryWorkPaperStack from './LibraryWorkPaperStack.svelte';
import type { EntuWork, EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const work: EntuWork = {
	id: 'work-a',
	libraryId: 'lib-1',
	composer: 'Maurice Duruflé',
	title: 'Requiem Op. 9',
	voicing: 'SATB + org.',
	language: 'Latin',
	year: 1947,
};

const editions: EntuEdition[] = [
	{ id: 'ed-1', workId: 'work-a', label: 'Peters · full score', year: 1991 },
	{ id: 'ed-2', workId: 'work-a', label: 'Durand · organ reduction', year: 1948 },
];

describe('LibraryWorkPaperStack', () => {
	it('renders composer and title', () => {
		const { container } = render(LibraryWorkPaperStack, {
			props: { work, editions, active: false },
		});
		expect(container.textContent).toContain('Maurice Duruflé');
		expect(container.textContent).toContain('Requiem Op. 9');
	});

	it('renders all editions as subcards', () => {
		render(LibraryWorkPaperStack, { props: { work, editions, active: false } });
		expect(screen.getByText('Peters · full score')).toBeTruthy();
		expect(screen.getByText('Durand · organ reduction')).toBeTruthy();
	});

	it('exposes data-work-id on the outer element', () => {
		const { container } = render(LibraryWorkPaperStack, {
			props: { work, editions, active: false },
		});
		const stack = container.querySelector('[data-work-id="work-a"]');
		expect(stack).not.toBeNull();
	});

	it('applies active class when active=true', () => {
		const { container } = render(LibraryWorkPaperStack, {
			props: { work, editions, active: true },
		});
		const stack = container.querySelector('.work-stack.active');
		expect(stack).not.toBeNull();
	});

	it('does not show active class when active=false', () => {
		const { container } = render(LibraryWorkPaperStack, {
			props: { work, editions, active: false },
		});
		const stack = container.querySelector('.work-stack.active');
		expect(stack).toBeNull();
	});

	it('shows inactive eyebrow label via paraglide key when active=false', () => {
		const { container } = render(LibraryWorkPaperStack, {
			props: { work, editions, active: false },
		});
		const eyebrow = container.querySelector('.work-tag');
		expect(eyebrow).not.toBeNull();
		expect(eyebrow?.textContent?.trim()).toBe('Work');
	});
});
