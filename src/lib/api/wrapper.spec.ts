// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLastProvider, setToken, setUser } from '../auth/storage';
import { apiRequest } from './wrapper';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	vi.restoreAllMocks();
});

describe('apiRequest', () => {
	it('passes Authorization: Bearer header from localStorage token', async () => {
		setToken('jwt-abc');
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/entity');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer jwt-abc' }),
			}),
		);
	});

	it('omits Authorization header when no token in storage', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/entity');

		const callArgs = fetchMock.mock.calls[0][1];
		const headers = callArgs?.headers ?? {};
		expect((headers as Record<string, string>).Authorization).toBeUndefined();
	});

	it('returns the parsed JSON response on 200', async () => {
		setToken('jwt');
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ entity: { _id: 'x' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
			),
		);

		const result = await apiRequest<{ entity: { _id: string } }>(
			'https://api.entu.app/polyphony/entity/x',
		);

		expect(result).toEqual({ entity: { _id: 'x' } });
	});

	it('throws on !res.ok with status code in the error message', async () => {
		setToken('jwt');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));

		await expect(apiRequest('https://api.entu.app/polyphony/entity/x')).rejects.toThrow(/403/);
	});

	it('forwards caller-supplied init options (method, body, additional headers)', async () => {
		setToken('jwt');
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
			);
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/property', {
			method: 'POST',
			body: JSON.stringify({ entity: 'x', type: 'name', string: 'hi' }),
			headers: { 'Content-Type': 'application/json' },
		});

		const callArgs = fetchMock.mock.calls[0][1];
		expect(callArgs?.method).toBe('POST');
		expect(callArgs?.body).toContain('"name"');
		expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
		expect((callArgs?.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
	});
});

describe('apiRequest 401 handling', () => {
	it('clears token/user/accounts on 401 (preserves mvox.last_provider)', async () => {
		setToken('expired-jwt');
		setUser({ _id: 'u1', email: 'a@b.c' });
		setLastProvider('google');
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
		);
		const gotoMock = vi.fn();
		vi.stubGlobal('__mvox_test_goto', gotoMock);

		await apiRequest('https://api.entu.app/polyphony/entity').catch(() => undefined);

		expect(localStorage.getItem('token')).toBeNull();
		expect(localStorage.getItem('mvox.last_provider')).toBe('google');
	});

	it('navigates to /auth/<last_provider>?intent=reauth&return_to=<current> on 401', async () => {
		setToken('expired-jwt');
		setLastProvider('google');
		Object.defineProperty(window, 'location', {
			value: { pathname: '/orgs', search: '?q=foo', href: 'https://multivox.pages.dev/orgs?q=foo' },
			writable: true,
		});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
		);
		const gotoMock = vi.fn();
		vi.stubGlobal('__mvox_test_goto', gotoMock);

		await apiRequest('https://api.entu.app/polyphony/entity').catch(() => undefined);

		expect(gotoMock).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/google\?/));
		const calledUrl = gotoMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('intent=reauth');
		expect(calledUrl).toContain('return_to=%2Forgs%3Fq%3Dfoo');
	});

	it('navigates to /auth/login on 401 when no last_provider stored', async () => {
		setToken('expired-jwt');
		Object.defineProperty(window, 'location', {
			value: { pathname: '/', search: '', href: 'https://multivox.pages.dev/' },
			writable: true,
		});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
		);
		const gotoMock = vi.fn();
		vi.stubGlobal('__mvox_test_goto', gotoMock);

		await apiRequest('https://api.entu.app/polyphony/entity').catch(() => undefined);

		expect(gotoMock).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/login\?/));
	});
});
