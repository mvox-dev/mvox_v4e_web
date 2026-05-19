import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJwt, createEntity, listEntities, type EntuClient } from './entu-client';

describe('getJwt', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('exchanges API key for a 48h JWT against the right URL', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ token: 'jwt-abc' }), { status: 200 })
			);

		const token = await getJwt({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key-xyz'
		});

		expect(token).toBe('jwt-abc');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/auth?db=polyphony',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer key-xyz' })
			})
		);
	});

	it('throws on non-2xx auth response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('Forbidden', { status: 403 })
		);
		await expect(
			getJwt({ apiBase: 'https://api.entu.app', db: 'polyphony', apiKey: 'bad' })
		).rejects.toThrow(/auth failed/i);
	});
});

describe('createEntity', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POSTs property array to /{db}/entity with JWT', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ _id: 'new-entity-id' }), { status: 200 })
			);

		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt-abc'
		};
		const result = await createEntity(client, [
			{ type: '_type', reference: 'type-id' },
			{ type: 'name', string: 'voice' }
		]);

		expect(result._id).toBe('new-entity-id');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer jwt-abc',
					'Content-Type': 'application/json'
				}),
				body: JSON.stringify([
					{ type: '_type', reference: 'type-id' },
					{ type: 'name', string: 'voice' }
				])
			})
		);
	});

	it('throws on non-2xx create response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('Bad Request', { status: 400 })
		);
		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt'
		};
		await expect(createEntity(client, [])).rejects.toThrow(/create failed/i);
	});
});

describe('listEntities', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('GETs /{db}/entity with query params and JWT', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					entities: [{ _id: 'e1' }, { _id: 'e2' }],
					count: 2
				}),
				{ status: 200 }
			)
		);

		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt-abc'
		};
		const result = await listEntities(client, {
			'_type.reference': 'meta-id',
			'_parent.reference': 'db-id'
		});

		expect(result.count).toBe(2);
		expect(result.entities).toHaveLength(2);
		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('https://api.entu.app/polyphony/entity?');
		expect(calledUrl).toContain('_type.reference=meta-id');
		expect(calledUrl).toContain('_parent.reference=db-id');
	});
});
