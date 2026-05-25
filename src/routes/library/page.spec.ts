// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/library') },
}));
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
}));
vi.mock('$lib/auth/userStore', () => ({
	selectedOrgStore: {
		subscribe: (cb: any) => {
			cb(null);
			return () => {};
		},
	},
	userStore: {
		subscribe: (cb: any) => {
			cb({ status: 'loading' });
			return () => {};
		},
	},
}));
vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return {
		librarySectionStore: store,
		hydrateLibrarySection: vi.fn(),
	};
});

import { librarySectionStore } from '$lib/library/libraryStore';

beforeEach(() => {
	librarySectionStore.set({ status: 'loading' });
});

describe('/library +page', () => {
	it('renders the three task stacks (Returns / Overdue / Pull for tonight)', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('Returns');
		expect(container.textContent).toContain('Overdue');
		expect(container.textContent).toContain('Pull for tonight');
		expect(container.textContent).toContain('ARRIVED');
		expect(container.textContent).toContain('OVERDUE');
		expect(container.textContent).toContain('TONIGHT');
	});

	it('renders the top strip with "On the desk today"', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('On the desk today');
		expect(container.textContent).toContain("librarian's desk");
	});

	it('renders specific bundle content (Tallis, Part, Tormis)', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('Thomas Tallis');
		expect(container.textContent).toContain('Arvo P\xe4rt');
		expect(container.textContent).toContain('Veljo Tormis');
	});
});

describe('library page — section-state rendering', () => {
	it('shows the empty-state marginalia when status is empty', async () => {
		librarySectionStore.set({
			status: 'empty',
			library: { id: 'lib-1', name: 'EFK Library', orgId: 'org-1', editorIds: ['p-1'] },
		});
		const { container } = render(Page);
		expect(container.textContent).toContain("Nothing's catalogued yet");
	});

	it('renders the master-detail when status is ready', async () => {
		librarySectionStore.set({
			status: 'ready',
			library: { id: 'lib-1', name: 'EFK Library', orgId: 'org-1', editorIds: ['p-1'] },
			works: [{ id: 'w-1', libraryId: 'lib-1', composer: 'Test', title: 'Title' }],
			editionsByWork: new Map([['w-1', []]]),
		});
		const { container } = render(Page);
		expect(container.querySelector('[data-work-id="w-1"]')).not.toBeNull();
	});
});

describe('library page — GH #71 over-fetch regression', () => {
	it('does NOT fire the unfiltered organization query', async () => {
		const fetchMock = vi.fn<
			(url: string) => Promise<{ ok: boolean; json: () => Promise<{ entities: never[] }> }>
		>(async () => ({ ok: true, json: async () => ({ entities: [] }) }));
		vi.stubGlobal('fetch', fetchMock);
		librarySectionStore.set({ status: 'loading' });
		render(Page);
		// Allow effects to fire
		await new Promise((r) => setTimeout(r, 50));
		const urls = fetchMock.mock.calls.map((c) => c[0]);
		const overFetch = urls.find(
			(u) =>
				u.includes('_type.string=organization') &&
				!u.includes('_owner.reference') &&
				u.includes('limit=50'),
		);
		expect(overFetch).toBeUndefined();
	});
});
