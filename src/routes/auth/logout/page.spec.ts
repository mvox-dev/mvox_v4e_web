// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
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
		userStore.set({ status: 'ready', name: 'Maire L.', initial: 'M', orgs: [] });
		expect(get(userStore).status).toBe('ready');

		// Act
		performLogout();

		// Assert: store must be signed-out; failing here means performLogout doesn't reset the store
		expect(get(userStore).status).toBe('signed-out');
	});
});
