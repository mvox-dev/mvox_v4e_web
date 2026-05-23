import { describe, expect, it, vi } from 'vitest';
import { load } from '../../../../routes/auth/callback/+page.server';

describe('/auth/callback server load', () => {
	it('returns sessionToken + state + db when both query params are present', async () => {
		const url = new URL(
			'https://multivox.pages.dev/auth/callback?key=session-abc&state=encoded-state',
		);
		const result = await (
			load as unknown as (e: {
				url: URL;
			}) => Promise<{ sessionToken: string; state: string; db: string }>
		)({
			url,
		});

		expect(result.sessionToken).toBe('session-abc');
		expect(result.state).toBe('encoded-state');
		expect(result.db).toBeTruthy();
	});

	it('redirects to /auth/login?error=missing_session_token when ?key is absent', async () => {
		const url = new URL('https://multivox.pages.dev/auth/callback?state=encoded-state');
		await expect(
			(load as unknown as (e: { url: URL }) => Promise<unknown>)({ url }),
		).rejects.toMatchObject({ status: 303 });
	});

	it('does NOT read or set csrf_state cookie (CSRF moves to client)', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session&state=state');
		await (load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>)({
			url,
			cookies: cookiesMock,
		});
		expect(cookiesMock.get).not.toHaveBeenCalled();
		expect(cookiesMock.set).not.toHaveBeenCalled();
	});
});
