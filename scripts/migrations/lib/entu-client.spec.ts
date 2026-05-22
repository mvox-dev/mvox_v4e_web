import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getJwt,
	createEntity,
	listEntities,
	fetchEntity,
	postProperties,
	deletePropertyValue,
	deleteEntity,
	listInstancesByType,
	type EntuClient,
} from './entu-client';

describe('getJwt', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('exchanges API key for a 48h JWT against the right URL', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ token: 'jwt-abc' }), { status: 200 }));

		const token = await getJwt({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key-xyz',
		});

		expect(token).toBe('jwt-abc');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/auth?db=polyphony',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer key-xyz' }),
			}),
		);
	});

	it('throws on non-2xx auth response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Forbidden', { status: 403 }));
		await expect(
			getJwt({ apiBase: 'https://api.entu.app', db: 'polyphony', apiKey: 'bad' }),
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
			.mockResolvedValue(new Response(JSON.stringify({ _id: 'new-entity-id' }), { status: 200 }));

		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt-abc',
		};
		const result = await createEntity(client, [
			{ type: '_type', reference: 'type-id' },
			{ type: 'name', string: 'voice' },
		]);

		expect(result._id).toBe('new-entity-id');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer jwt-abc',
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify([
					{ type: '_type', reference: 'type-id' },
					{ type: 'name', string: 'voice' },
				]),
			}),
		);
	});

	it('throws on non-2xx create response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad Request', { status: 400 }));
		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt',
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
					count: 2,
				}),
				{ status: 200 },
			),
		);

		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt-abc',
		};
		const result = await listEntities(client, {
			'_type.reference': 'meta-id',
			'_parent.reference': 'db-id',
		});

		expect(result.count).toBe(2);
		expect(result.entities).toHaveLength(2);
		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('https://api.entu.app/polyphony/entity?');
		expect(calledUrl).toContain('_type.reference=meta-id');
		expect(calledUrl).toContain('_parent.reference=db-id');
	});
});

// ── Toolkit extraction RED tests (#57) ────────────────────────────────────────
//
// These five functions are promoted from phase-b.ts into entu-client.ts.
// Tests fail until Josquin GREEN adds the exports.
//
// (*MVOX:Tallis*)

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt',
};

describe('fetchEntity', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('GETs /entity/{id} and returns parsed entity body', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify({ entity: { _id: 'e1', name: [{ string: 'alto' }] } }), {
				status: 200,
			}),
		);

		const result = await fetchEntity(client, 'e1');

		expect(result._id).toBe('e1');
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.entu.app/polyphony/entity/e1');
		expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
	});

	it('throws on non-2xx response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
		await expect(fetchEntity(client, 'missing')).rejects.toThrow();
	});
});

describe('postProperties', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('POSTs property array to /entity/{id} with JSON body', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({ _id: 'e1' }), { status: 200 }));

		await postProperties(client, 'e1', [
			{ type: 'name', string: 'soprano' },
			{ type: 'sort', number: 1 },
		]);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.entu.app/polyphony/entity/e1');
		expect((init as RequestInit).method).toBe('POST');
		const body = JSON.parse((init as RequestInit).body as string) as unknown[];
		expect(body).toHaveLength(2);
		expect(body[0]).toMatchObject({ type: 'name', string: 'soprano' });
	});

	it('throws on non-2xx response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
		await expect(postProperties(client, 'e1', [])).rejects.toThrow();
	});
});

describe('deletePropertyValue', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('sends DELETE to /property/{propValueId} (not /entity/)', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true }), { status: 200 }));

		await deletePropertyValue(client, 'pv-123');

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.entu.app/polyphony/property/pv-123');
		expect(url).not.toContain('/entity/');
		expect((init as RequestInit).method).toBe('DELETE');
	});

	it('throws on non-2xx response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
		await expect(deletePropertyValue(client, 'pv-missing')).rejects.toThrow();
	});
});

describe('deleteEntity', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('sends DELETE to /entity/{entityId} (not /property/)', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true }), { status: 200 }));

		await deleteEntity(client, 'prop-def-id');

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.entu.app/polyphony/entity/prop-def-id');
		expect(url).not.toContain('/property/');
		expect((init as RequestInit).method).toBe('DELETE');
	});

	it('throws on non-2xx response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
		await expect(deleteEntity(client, 'missing-id')).rejects.toThrow();
	});
});

describe('listInstancesByType', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('queries _type.string=<typeName> with default limit=500', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [{ _id: 'e1' }], count: 1 }), { status: 200 }),
			);

		const result = await listInstancesByType(client, 'section', '_id');

		expect(result.entities).toHaveLength(1);
		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('_type.string=section');
		expect(calledUrl).toContain('limit=500');
		expect(calledUrl).toContain('props=_id');
	});

	it('accepts an explicit limit that overrides the default', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 }),
			);

		await listInstancesByType(client, 'member', '_id', 50);

		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('limit=50');
		expect(calledUrl).not.toContain('limit=500');
	});

	it('accepts extraQuery filter at position 4 (merged into query params)', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 }),
			);

		await listInstancesByType(client, 'section', '_id', { '_parent.reference': 'org-1' });

		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('_parent.reference=org-1');
		expect(calledUrl).toContain('limit=500'); // default still applies when extraQuery is used
	});

	it('throws on non-2xx response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('Server Error', { status: 500 }),
		);
		await expect(listInstancesByType(client, 'section', '_id')).rejects.toThrow();
	});
});
