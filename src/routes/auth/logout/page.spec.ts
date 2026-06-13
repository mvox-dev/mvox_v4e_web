// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	getAccounts,
	getLastProvider,
	getToken,
	getUser,
	setAccounts,
	setLastProvider,
	setToken,
	setUser,
} from '../../../lib/auth/storage';
import { userStore } from '../../../lib/auth/userStore';
import { performLogout } from './perform-logout';

vi.mock('$lib/server/auth/session-cookie', () => ({
	SESSION_COOKIE: 'mvox_session',
}));

describe('logout +page.server.ts load — clears mvox_session', () => {
	it('deletes mvox_session cookie at path /', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const { load } = await import('./+page.server');
		await (
			load as unknown as (e: { cookies: typeof cookiesMock }) => Promise<unknown>
		)({ cookies: cookiesMock });

		const deletedNames = cookiesMock.delete.mock.calls.map((c) => c[0] as string);
		expect(deletedNames).toContain('mvox_session');
	});
});

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe('performLogout', () => {
	it('clears token, user, accounts AND mvox.last_provider', () => {
		setToken('jwt');
		setUser({ _id: 'u1', email: 'a@b.c' });
		setAccounts([{ _id: 'a1' }]);
		setLastProvider('google');
		sessionStorage.setItem('mvox.oauth_nonce', 'nonce');

		performLogout();

		expect(getToken()).toBeNull();
		expect(getUser()).toBeNull();
		expect(getAccounts()).toEqual([]);
		expect(getLastProvider()).toBeNull();
		expect(sessionStorage.getItem('mvox.oauth_nonce')).toBeNull();
	});

	it('resets userStore to signed-out so SPA nav does not greet the logged-out user', () => {
		// Arrange: simulate an authenticated in-memory store (no hydrateUserStore needed)
		userStore.set({ status: 'ready', name: 'Maire L.', initial: 'M', personId: 'p1', orgs: [] });
		expect(get(userStore).status).toBe('ready');

		// Act
		performLogout();

		// Assert: store must be signed-out; failing here means performLogout doesn't reset the store
		expect(get(userStore).status).toBe('signed-out');
	});
});
