// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setUser } from '../../../lib/auth/storage';
import { buildOAuthInitUrl } from './build-oauth-init-url';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	vi.restoreAllMocks();
});

describe('buildOAuthInitUrl', () => {
	it('builds api.entu.app/auth/<provider>?next=<callback>&state=<encoded>', () => {
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/orgs',
			intent: 'login',
			nonce: 'fixed-nonce-for-test',
		});

		const parsed = new URL(url);
		expect(parsed.origin).toBe('https://api.entu.app');
		expect(parsed.pathname).toBe('/auth/google');

		const next = parsed.searchParams.get('next');
		expect(next).not.toBeNull();

		const nextUrl = new URL(next as string);
		expect(nextUrl.pathname).toBe('/auth/callback');
		expect(nextUrl.searchParams.get('state')).toBeTruthy();
	});

	it('includes login_hint from localStorage user email (forward-compat; no-op today)', () => {
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

	it('encoded state decodes to the provided payload', async () => {
		const { decodeState } = await import('../../../lib/auth/state');
		const url = buildOAuthInitUrl({
			provider: 'smart-id',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/orgs?q=foo',
			intent: 'reauth',
			nonce: 'nonce-123',
		});

		const next = new URL(url).searchParams.get('next') as string;
		const stateEncoded = new URL(next).searchParams.get('state') as string;

		expect(decodeState(stateEncoded)).toEqual({
			nonce: 'nonce-123',
			return_to: '/orgs?q=foo',
			intent: 'reauth',
		});
	});
});
