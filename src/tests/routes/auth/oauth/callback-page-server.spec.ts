import { describe, expect, it, vi } from 'vitest';
import { load } from '../../../../routes/auth/callback/+page.server';

describe('/auth/callback server load', () => {
	it('returns sessionToken + db when ?key is present', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session-abc');
		const result = await (
			load as unknown as (e: {
				url: URL;
				cookies: typeof cookiesMock;
			}) => Promise<{ sessionToken: string; db: string }>
		)({
			url,
			cookies: cookiesMock,
		});
		expect(result.sessionToken).toBe('session-abc');
		expect(result.db).toBeTruthy();
	});

	it('redirects to /auth/login?error=missing_session_token when ?key is absent', async () => {
		const url = new URL('https://multivox.pages.dev/auth/callback');
		await expect(
			(load as unknown as (e: { url: URL }) => Promise<unknown>)({ url }),
		).rejects.toMatchObject({ status: 303 });
	});

	it('sets the mvox_session cookie and does not read any cookie (CHORE-79)', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session');
		await (load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>)({
			url,
			cookies: cookiesMock,
		});
		// We never READ a cookie on the callback (no CSRF cookie under Path C).
		expect(cookiesMock.get).not.toHaveBeenCalled();
		// AC5: the server SETS the httpOnly mvox_session cookie = the session JWT.
		expect(cookiesMock.set).toHaveBeenCalledWith(
			'mvox_session',
			'session',
			expect.objectContaining({
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				maxAge: 172800,
			}),
		);
	});
});
