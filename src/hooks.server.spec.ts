import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';

// Minimal mock for Cookies
function makeCookies(store: Record<string, string>): Cookies {
	return {
		get: (name: string) => store[name] ?? null,
		getAll: () => Object.entries(store).map(([name, value]) => ({ name, value })),
		set: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn().mockReturnValue(''),
	} as unknown as Cookies;
}

// Minimal mock for RequestEvent
function makeEvent(cookies: Cookies, locals: App.Locals = {} as App.Locals): RequestEvent {
	return {
		cookies,
		locals,
		request: new Request('https://example.com/'),
		url: new URL('https://example.com/'),
		params: {},
		route: { id: null },
		platform: undefined,
		fetch: vi.fn(),
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
	} as unknown as RequestEvent;
}

describe('hooks.server handle', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reads entu_jwt cookie and exposes it on event.locals', async () => {
		const { handle } = await import('./hooks.server.ts');

		const cookies = makeCookies({ entu_jwt: 'abc.def.ghi' });
		const event = makeEvent(cookies);
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));

		await handle({ event, resolve });

		expect(event.locals.entuJwt).toBe('abc.def.ghi');
	});

	it('sets entuJwt to null/undefined when no cookie is present', async () => {
		const { handle } = await import('./hooks.server.ts');

		const cookies = makeCookies({});
		const event = makeEvent(cookies);
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));

		await handle({ event, resolve });

		expect(event.locals.entuJwt == null).toBe(true);
	});

	it('calls resolve with the event', async () => {
		const { handle } = await import('./hooks.server.ts');

		const cookies = makeCookies({ entu_jwt: 'tok' });
		const event = makeEvent(cookies);
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));

		await handle({ event, resolve });

		expect(resolve).toHaveBeenCalledOnce();
		expect(resolve).toHaveBeenCalledWith(event);
	});

	it('returns the response from resolve', async () => {
		const { handle } = await import('./hooks.server.ts');

		const cookies = makeCookies({});
		const event = makeEvent(cookies);
		const expected = new Response('hello');
		const resolve = vi.fn().mockResolvedValue(expected);

		const response = await handle({ event, resolve });

		expect(response).toBe(expected);
	});
});
