// @vitest-environment happy-dom
// src/lib/components/library/LibraryMasterDetail.spec.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import LibraryMasterDetail from './LibraryMasterDetail.svelte';
import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const library: EntuLibrary = {
	id: 'lib-1',
	name: 'EFK Library',
	orgId: 'org-1',
	editorIds: ['person-1'],
};
const works: EntuWork[] = [
	{ id: 'work-a', libraryId: 'lib-1', composer: 'Duruflé', title: 'Requiem', voicing: 'SATB' },
	{ id: 'work-b', libraryId: 'lib-1', composer: 'Kreek', title: 'Taaveti', voicing: 'SATB' },
];
const editionsByWork = new Map<string, EntuEdition[]>([
	['work-a', [{ id: 'ed-1', workId: 'work-a', label: 'Peters', year: 1991 }]],
	['work-b', []],
]);

beforeEach(() => {
	// stub IntersectionObserver
	(globalThis as any).IntersectionObserver = class {
		observe = vi.fn();
		disconnect = vi.fn();
		unobserve = vi.fn();
	};
});

describe('LibraryMasterDetail', () => {
	it('renders the master and a paperstack per work', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		expect(container.querySelector('[data-work-id="work-a"]')).not.toBeNull();
		expect(container.querySelector('[data-work-id="work-b"]')).not.toBeNull();
	});

	it('selects the first work by default when no initialWorkId', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		const masterRowSel = container.querySelector('.master-paper [data-work-id="work-a"].sel');
		expect(masterRowSel).not.toBeNull();
	});

	it('selects the initialWorkId when provided', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-b' },
		});
		const masterRowSel = container.querySelector('.master-paper [data-work-id="work-b"].sel');
		expect(masterRowSel).not.toBeNull();
	});

	it('updates selection on master row click', async () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		const masterRowB = container.querySelector(
			'.master-paper [data-work-id="work-b"]',
		) as HTMLElement;
		await fireEvent.click(masterRowB);
		expect(container.querySelector('.master-paper [data-work-id="work-b"].sel')).not.toBeNull();
		expect(container.querySelector('.master-paper [data-work-id="work-a"].sel')).toBeNull();
	});
});
