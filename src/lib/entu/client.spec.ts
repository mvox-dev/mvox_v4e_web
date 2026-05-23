import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntuClient } from './client';

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('EntuClient', () => {
	const baseConfig = { jwt: 'jwt-abc', db: 'polyphony' };

	it('constructs with explicit baseUrl override', () => {
		const c = new EntuClient({ ...baseConfig, baseUrl: 'https://custom.example/' });
		expect(c).toBeInstanceOf(EntuClient);
	});

	it('defaults baseUrl to api.entu.app when not supplied', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entity: { _id: 'x' } }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.get('x');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity/x',
			expect.any(Object),
		);
	});

	it('get() sends Authorization: Bearer header', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entity: { _id: 'x' } }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.get('x');

		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer jwt-abc' }),
			}),
		);
	});

	it('get() throws with status code on !res.ok', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response('forbidden', { status: 403 }),
		));

		const c = new EntuClient(baseConfig);
		await expect(c.get('x')).rejects.toThrow(/403/);
	});

	it('search() builds query string from query object', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entities: [] }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.search({ '_type.string': 'organization', limit: 50 });

		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('https://api.entu.app/polyphony/entity?');
		expect(calledUrl).toContain('_type.string=organization');
		expect(calledUrl).toContain('limit=50');
	});

	it('search() throws with status code on !res.ok (CHORE-52 defensive throw)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response('forbidden', { status: 403 }),
		));

		const c = new EntuClient(baseConfig);
		await expect(c.search({ '_type.string': 'organization' })).rejects.toThrow(/403/);
	});

	it('search() omits undefined values from the query string', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entities: [] }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.search({ '_type.string': 'organization', limit: undefined });

		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).not.toContain('limit=');
	});

	it('setProperty() POSTs to /property with content-type and body', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ _id: 'prop-1' }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.setProperty('entity-1', 'name', 'Acme');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/property',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer jwt-abc',
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({ entity: 'entity-1', type: 'name', string: 'Acme' }),
			}),
		);
	});
});
