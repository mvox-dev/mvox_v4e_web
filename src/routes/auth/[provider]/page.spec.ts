// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { setUser } from '../../../lib/auth/storage';
import { decodeState } from '../../../lib/auth/state';
import { buildOAuthInitUrl } from './build-oauth-init-url';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe('buildOAuthInitUrl', () => {
	it('builds api.entu.app/auth/<provider>?next=<callback-with-key-stub>', () => {
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/',
			intent: 'login',
			nonce: 'fixed-nonce',
		});
		const parsed = new URL(url);
		expect(parsed.origin).toBe('https://api.entu.app');
		expect(parsed.pathname).toBe('/auth/google');
		expect(parsed.searchParams.get('next')).toBe('https://multivox.pages.dev/auth/callback?key=');
	});

	it('stores encoded state in localStorage as mvox.oauth_state', () => {
		buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/orgs',
			intent: 'login',
			nonce: 'fixed-nonce',
		});
		expect(localStorage.getItem('mvox.oauth_state')).toBeTruthy();
	});

	it('stored state decodes to the provided payload', () => {
		buildOAuthInitUrl({
			provider: 'smart-id',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/orgs?q=foo',
			intent: 'reauth',
			nonce: 'nonce-123',
		});
		const stored = localStorage.getItem('mvox.oauth_state');
		expect(decodeState(stored as string)).toEqual({
			nonce: 'nonce-123',
			return_to: '/orgs?q=foo',
			intent: 'reauth',
		});
	});

	it('includes login_hint from localStorage user email (forward-compat)', () => {
		setUser({ _id: 'u1', email: 'alice@example.com' });
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/',
			intent: 'reauth',
			nonce: 'fixed-nonce',
		});
		expect(new URL(url).searchParams.get('login_hint')).toBe('alice@example.com');
	});

	it('omits login_hint when no user in storage', () => {
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/',
			intent: 'login',
			nonce: 'fixed-nonce',
		});
		expect(new URL(url).searchParams.has('login_hint')).toBe(false);
	});
});
