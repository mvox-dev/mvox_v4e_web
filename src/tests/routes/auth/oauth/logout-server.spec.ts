/**
 * RED tests for src/routes/auth/logout/+server.ts POST handler
 *
 * Clears the entu_jwt cookie and redirects to /.
 * No Entu API call needed — JWT is stateless on Entu's side.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';

function makeCookies(hasJwt = true): Cookies {
	const store: Record<string, string> = {};
	if (hasJwt) store['entu_jwt'] = 'some.jwt.token';
	return {
		get: (name: string) => store[name] ?? null,
		getAll: () => Object.entries(store).map(([name, value]) => ({ name, value })),
		set: vi.fn(),
		delete: vi.fn((name: string) => { delete store[name]; }),
		serialize: vi.fn().mockReturnValue(''),
	} as unknown as Cookies;
}

function makeLogoutEvent(): RequestEvent {
	return {
		cookies: makeCookies(),
		locals: { entuJwt: 'some.jwt.token' } as App.Locals,
		request: new Request('https://multivox.pages.dev/auth/logout', { method: 'POST' }),
		url: new URL('https://multivox.pages.dev/auth/logout'),
		params: {},
		route: { id: '/auth/logout' },
		platform: undefined,
		fetch: vi.fn(),
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
	} as unknown as RequestEvent;
}

describe('POST /auth/logout', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('deletes the entu_jwt cookie with path /', async () => {
		const { POST } = await import('../../../../routes/auth/logout/+server.ts');
		const event = makeLogoutEvent();
		await POST(event);

		expect(event.cookies.delete).toHaveBeenCalledWith('entu_jwt', expect.objectContaining({ path: '/' }));
	});

	it('returns a 303 redirect to /', async () => {
		const { POST } = await import('../../../../routes/auth/logout/+server.ts');
		const event = makeLogoutEvent();
		const response = await POST(event);

		expect(response.status).toBe(303);
		expect(response.headers.get('Location')).toBe('/');
	});

	it('does not call any external API', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const { POST } = await import('../../../../routes/auth/logout/+server.ts');
		const event = makeLogoutEvent();
		await POST(event);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(event.fetch).not.toHaveBeenCalled();
	});

	it('still returns 303 redirect even when no jwt cookie is present', async () => {
		const { POST } = await import('../../../../routes/auth/logout/+server.ts');
		const event = makeLogoutEvent();
		(event.cookies as ReturnType<typeof makeCookies>);
		const response = await POST(event);

		expect(response.status).toBe(303);
	});
});
