// src/lib/library/libraryStore.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { librarySectionStore, hydrateLibrarySection } from './libraryStore';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'test-env-db' }));
vi.mock('$lib/auth/storage', () => ({ getToken: () => 'fake.token' }));

beforeEach(() => {
	vi.restoreAllMocks();
	vi.stubGlobal('fetch', vi.fn());
	librarySectionStore.set({ status: 'loading' });
});

describe('librarySectionStore', () => {
	it('starts in loading state', () => {
		expect(get(librarySectionStore).status).toBe('loading');
	});

	it('transitions to no-rights when hydrateLibrary returns no-rights', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ entities: [] }),
		});
		await hydrateLibrarySection({ orgId: 'org-1', personId: 'person-1' });
		expect(get(librarySectionStore).status).toBe('no-rights');
	});

	it('transitions to error when the token is missing', async () => {
		// override the mock to return null
		const storage = await import('$lib/auth/storage');
		vi.spyOn(storage, 'getToken').mockReturnValue(null);
		await hydrateLibrarySection({ orgId: 'org-1', personId: 'person-1' });
		expect(get(librarySectionStore).status).toBe('error');
	});
});
