// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
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
});
