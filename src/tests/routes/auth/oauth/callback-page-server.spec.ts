import { describe, expect, it, vi } from 'vitest';
import { load } from '../../../../routes/auth/callback/+page.server';

describe('/auth/callback server load', () => {
	it('returns sessionToken + db when ?key is present', async () => {
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session-abc');
		const result = await (
			load as unknown as (e: { url: URL }) => Promise<{ sessionToken: string; db: string }>
		)({
			url,
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

	it('does NOT read or set csrf_state cookie', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session');
		await (load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>)({
			url,
			cookies: cookiesMock,
		});
		expect(cookiesMock.get).not.toHaveBeenCalled();
		expect(cookiesMock.set).not.toHaveBeenCalled();
	});
});
