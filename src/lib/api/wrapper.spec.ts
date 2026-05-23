// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../auth/storage';
import { apiRequest } from './wrapper';

beforeEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('apiRequest', () => {
	it('passes Authorization: Bearer header from localStorage token', async () => {
		setToken('jwt-abc');
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);
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
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(null, { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/entity');

		const callArgs = fetchMock.mock.calls[0][1];
		const headers = callArgs?.headers ?? {};
		expect((headers as Record<string, string>).Authorization).toBeUndefined();
	});

	it('returns the parsed JSON response on 200', async () => {
		setToken('jwt');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entity: { _id: 'x' } }), { status: 200 }),
		));

		const result = await apiRequest<{ entity: { _id: string } }>(
			'https://api.entu.app/polyphony/entity/x',
		);

		expect(result).toEqual({ entity: { _id: 'x' } });
	});

	it('throws on !res.ok with status code in the error message', async () => {
		setToken('jwt');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response('forbidden', { status: 403 }),
		));

		await expect(
			apiRequest('https://api.entu.app/polyphony/entity/x'),
		).rejects.toThrow(/403/);
	});

	it('forwards caller-supplied init options (method, body, additional headers)', async () => {
		setToken('jwt');
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('{}', { status: 200 }),
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
