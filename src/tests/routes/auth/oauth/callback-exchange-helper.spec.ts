import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeSession } from '../../../../lib/auth/exchange';

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('exchangeSession', () => {
	it('returns { ok: false, error: "missing_session_token" } when sessionToken is empty', async () => {
		const result = await exchangeSession({ sessionToken: '', db: 'polyphony' });
		expect(result).toEqual({ ok: false, error: 'missing_session_token' });
	});

	it('calls api.entu.app/auth with Bearer session token + db query', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ token: 'jwt-xyz', accounts: [], user: {} }), { status: 200 }),
			);
		vi.stubGlobal('fetch', fetchMock);

		await exchangeSession({ sessionToken: 'session-abc', db: 'polyphony' });

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/auth?db=polyphony',
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer session-abc',
				}),
			}),
		);
	});

	it('returns { ok: true, token, accounts, user } on success', async () => {
		const payload = {
			token: 'jwt-xyz',
			accounts: [{ _id: 'a1', name: 'Acme' }],
			user: { _id: 'u1', email: 'alice@example.com' },
		};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })),
		);

		const result = await exchangeSession({ sessionToken: 'session-abc', db: 'polyphony' });

		expect(result).toEqual({ ok: true, ...payload });
	});

	it('returns { ok: false, error: "entu_auth_failed" } when Entu returns non-2xx', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));

		const result = await exchangeSession({ sessionToken: 'session-abc', db: 'polyphony' });

		expect(result).toEqual({ ok: false, error: 'entu_auth_failed' });
	});

	it('returns { ok: false, error: "entu_auth_failed" } on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

		const result = await exchangeSession({ sessionToken: 'session-abc', db: 'polyphony' });

		expect(result).toEqual({ ok: false, error: 'entu_auth_failed' });
	});

	it('does NOT POST to /auth/cookie under Path C', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ token: 'jwt' }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		await exchangeSession({ sessionToken: 'session-abc', db: 'polyphony' });

		const urls = fetchMock.mock.calls.map((c) => c[0]);
		expect(urls).not.toContain('/auth/cookie');
		expect(urls.every((u) => !String(u).includes('/auth/cookie'))).toBe(true);
	});
});
