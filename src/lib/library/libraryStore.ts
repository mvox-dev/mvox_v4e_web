// src/lib/library/libraryStore.ts
import { writable, type Writable } from 'svelte/store';
import { getToken } from '$lib/auth/storage';
import { hydrateLibrary, type LibraryHydrationResult } from './hydrateLibrary';

export type LibrarySectionState = { status: 'loading' } | LibraryHydrationResult;

export const librarySectionStore: Writable<LibrarySectionState> = writable({ status: 'loading' });

export async function hydrateLibrarySection(args: {
	orgId: string;
	personId: string;
}): Promise<void> {
	librarySectionStore.set({ status: 'loading' });
	const token = getToken();
	if (!token) {
		librarySectionStore.set({ status: 'error', reason: 'no token' });
		return;
	}
	const result = await hydrateLibrary({ ...args, token });
	librarySectionStore.set(result);
}
