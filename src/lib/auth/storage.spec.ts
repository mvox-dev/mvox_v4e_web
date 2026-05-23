// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearAll,
	getAccounts,
	getLastProvider,
	getToken,
	getUser,
	setAccounts,
	setLastProvider,
	setToken,
	setUser,
} from './storage';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe('storage', () => {
	it('returns null token when nothing stored', () => {
		expect(getToken()).toBeNull();
	});

	it('stores and retrieves token, writing token_version=1', () => {
		setToken('jwt-abc');
		expect(getToken()).toBe('jwt-abc');
		expect(localStorage.getItem('mvox.token_version')).toBe('1');
	});

	it('treats a stale token_version as no-token + force-clears related keys', () => {
		setToken('jwt-abc');
		setUser({ _id: 'u1', email: 'a@b.c' });
		localStorage.setItem('mvox.token_version', '99');
		expect(getToken()).toBeNull();
		expect(getUser()).toBeNull();
	});

	it('stores and retrieves user (incl. email field)', () => {
		setUser({ _id: 'u1', email: 'a@b.c', name: 'Alice' });
		expect(getUser()).toEqual({ _id: 'u1', email: 'a@b.c', name: 'Alice' });
	});

	it('stores and retrieves accounts array', () => {
		setAccounts([{ _id: 'a1', name: 'Acme' }]);
		expect(getAccounts()).toEqual([{ _id: 'a1', name: 'Acme' }]);
	});

	it('getAccounts returns empty array when nothing stored', () => {
		expect(getAccounts()).toEqual([]);
	});

	it('stores and retrieves last_provider', () => {
		setLastProvider('google');
		expect(getLastProvider()).toBe('google');
	});

	it('clearAll with preserveProvider=true keeps mvox.last_provider, clears everything else', () => {
		setToken('jwt');
		setUser({ _id: 'u1' });
		setAccounts([{ _id: 'a1' }]);
		setLastProvider('google');
		sessionStorage.setItem('mvox.oauth_nonce', 'nonce-abc');

		clearAll({ preserveProvider: true });

		expect(getToken()).toBeNull();
		expect(getUser()).toBeNull();
		expect(getAccounts()).toEqual([]);
		expect(getLastProvider()).toBe('google');
		expect(sessionStorage.getItem('mvox.oauth_nonce')).toBeNull();
	});

	it('clearAll with preserveProvider=false clears everything incl. last_provider', () => {
		setToken('jwt');
		setLastProvider('google');

		clearAll({ preserveProvider: false });

		expect(getToken()).toBeNull();
		expect(getLastProvider()).toBeNull();
	});
});
