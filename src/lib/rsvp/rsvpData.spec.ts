import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	listMyRsvps,
	findMyMemberId,
	createRsvp,
	updateRsvpStatus,
	deleteRsvp,
	resetMemberIdCache,
} from './rsvpData';
import { resetTypeIdCache } from '$lib/seasons/entuSeasons';

const cfg = { db: 'testdb', token: 'jwt' };

beforeEach(() => {
	vi.restoreAllMocks();
	resetTypeIdCache();
	resetMemberIdCache();
});

// ── listMyRsvps ───────────────────────────────────────────────────────────────

describe('listMyRsvps', () => {
	it('queries with _type.string=rsvp and _parent.reference={personId}', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await listMyRsvps(cfg, 'person-abc');
		expect(fetchMock).toHaveBeenCalled();
		const url: string = (fetchMock.mock.calls[0] as [string])[0];
		expect(url).toContain('_type.string=rsvp');
		expect(url).toContain('person-abc');
	});

	it('maps entities to full-shape MyRsvp[]', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'rsvp-1',
							event: [{ reference: 'event-x' }],
							status: [{ string: 'going' }],
						},
						{
							_id: 'rsvp-2',
							event: [{ reference: 'event-y' }],
							status: [{ string: 'maybe' }],
						},
					],
				}),
			}),
		);
		const rsvps = await listMyRsvps(cfg, 'person-abc');
		expect(rsvps).toEqual([
			{ rsvpId: 'rsvp-1', eventId: 'event-x', status: 'going' },
			{ rsvpId: 'rsvp-2', eventId: 'event-y', status: 'maybe' },
		]);
	});

	it('returns [] when entities array is empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		const rsvps = await listMyRsvps(cfg, 'person-abc');
		expect(rsvps).toEqual([]);
	});

	it('throws on !ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(listMyRsvps(cfg, 'person-abc')).rejects.toThrow('403');
	});
});

// ── findMyMemberId ────────────────────────────────────────────────────────────

describe('findMyMemberId', () => {
	it('queries with member type + person ref + org ref + status=active', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [{ _id: 'member-1' }] }),
		});
		vi.stubGlobal('fetch', fetchMock);
		const result = await findMyMemberId(cfg, 'person-p', 'org-o');
		expect(result).toBe('member-1');
		const url: string = (fetchMock.mock.calls[0] as [string])[0];
		expect(url).toContain('_type.string=member');
		expect(url).toContain('person-p');
		expect(url).toContain('org-o');
		expect(url).toContain('status.string=active');
	});

	it('returns the first entity _id when found', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ entities: [{ _id: 'member-42' }] }),
			}),
		);
		const id = await findMyMemberId(cfg, 'p', 'o');
		expect(id).toBe('member-42');
	});

	it('returns null when entities array is empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		const id = await findMyMemberId(cfg, 'p', 'o');
		expect(id).toBeNull();
	});

	it('second call with same person+org does NOT refetch (memoized)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [{ _id: 'member-1' }] }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await findMyMemberId(cfg, 'p1', 'o1');
		await findMyMemberId(cfg, 'p1', 'o1');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('different org triggers a new fetch', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [{ _id: 'member-1' }] }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await findMyMemberId(cfg, 'p1', 'o1');
		await findMyMemberId(cfg, 'p1', 'o2');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('throws on !ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
		);
		await expect(findMyMemberId(cfg, 'p', 'o')).rejects.toThrow('401');
	});
});

// ── createRsvp ────────────────────────────────────────────────────────────────

describe('createRsvp', () => {
	/** Build a fetch mock that handles type-resolution GETs + entity-create POST */
	function makeFetchMock(resolvedTypeId = 'rsvp-type-id') {
		return vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ entities: [{ _id: resolvedTypeId }] }),
				});
			}
			// entity create POST → return created _id
			return Promise.resolve({ ok: true, json: async () => ({ _id: 'new-rsvp-1' }) });
		});
	}

	it('POST body contains _type as resolved reference (NOT string)', async () => {
		const fetchMock = makeFetchMock('rsvp-type-42');
		vi.stubGlobal('fetch', fetchMock);
		await createRsvp(cfg, {
			personId: 'person-1',
			eventId: 'event-1',
			memberId: 'member-1',
			status: 'going',
		});
		const createCall = (fetchMock.mock.calls as Array<[string, { body: string }]>).find(
			([url]) => !url.includes('_type.string=entity'),
		)!;
		const body = JSON.parse(createCall[1].body);
		expect(body).toEqual(
			expect.arrayContaining([{ type: '_type', reference: 'rsvp-type-42' }]),
		);
	});

	it('POST body full-shape: _parent=personId, event ref, member ref, status string', async () => {
		const fetchMock = makeFetchMock('type-id');
		vi.stubGlobal('fetch', fetchMock);
		await createRsvp(cfg, {
			personId: 'person-p',
			eventId: 'event-e',
			memberId: 'member-m',
			status: 'maybe',
		});
		const createCall = (fetchMock.mock.calls as Array<[string, { body: string }]>).find(
			([url]) => !url.includes('_type.string=entity'),
		)!;
		const body = JSON.parse(createCall[1].body);
		expect(body).toEqual(
			expect.arrayContaining([
				{ type: '_type', reference: 'type-id' },
				{ type: '_parent', reference: 'person-p' },
				{ type: 'event', reference: 'event-e' },
				{ type: 'member', reference: 'member-m' },
				{ type: 'status', string: 'maybe' },
			]),
		);
	});

	it('POST body does NOT contain _sharing property', async () => {
		// rsvp is private by default (parent=person is private); no explicit _sharing needed
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createRsvp(cfg, {
			personId: 'person-p',
			eventId: 'event-e',
			memberId: 'member-m',
			status: 'going',
		});
		const createCall = (fetchMock.mock.calls as Array<[string, { body: string }]>).find(
			([url]) => !url.includes('_type.string=entity'),
		)!;
		const body = JSON.parse(createCall[1].body) as Array<{ type: string }>;
		expect(body.some((p) => p.type === '_sharing')).toBe(false);
	});

	it('returns the created rsvp _id', async () => {
		vi.stubGlobal('fetch', makeFetchMock());
		const id = await createRsvp(cfg, {
			personId: 'p',
			eventId: 'e',
			memberId: 'm',
			status: 'not_going',
		});
		expect(id).toBe('new-rsvp-1');
	});

	it('throws on !ok create response (status surfaced)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('_type.string=entity')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'type-id' }] }),
					});
				}
				return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
			}),
		);
		await expect(
			createRsvp(cfg, { personId: 'p', eventId: 'e', memberId: 'm', status: 'going' }),
		).rejects.toThrow('403');
	});
});

// ── updateRsvpStatus ──────────────────────────────────────────────────────────

describe('updateRsvpStatus', () => {
	/** Mock that handles GET (returns rsvp with existing status value-id),
	 *  DELETE, and POST, recording calls for order assertion. */
	function makeMockFetch(statusValueId = 'sv-1') {
		const calls: Array<{ url: string; method: string; body?: unknown }> = [];
		const fetchMock = vi
			.fn()
			.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
				const method = init?.method ?? 'GET';
				calls.push({ url, method, body: init?.body ? JSON.parse(init.body) : undefined });
				if (method === 'DELETE') {
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				if (method === 'POST') {
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				// GET rsvp entity
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: {
							_id: 'rsvp-1',
							status: [{ _id: statusValueId, string: 'going' }],
						},
					}),
				});
			});
		return { fetchMock, calls };
	}

	it('GETs rsvp props, DELETEs existing status value, then POSTs new status (order matters)', async () => {
		const { fetchMock, calls } = makeMockFetch('sv-old');
		vi.stubGlobal('fetch', fetchMock);

		await updateRsvpStatus(cfg, 'rsvp-1', 'not_going');

		// Verify order: GET → DELETE → POST
		expect(calls[0].method).toBe('GET');
		const deleteIdx = calls.findIndex((c) => c.method === 'DELETE');
		const postIdx = calls.findIndex((c) => c.method === 'POST');
		expect(deleteIdx).toBeGreaterThan(0); // DELETE comes after GET
		expect(postIdx).toBeGreaterThan(deleteIdx); // POST comes after DELETE
	});

	it('DELETE targets the existing status value-id (not the rsvp entity)', async () => {
		const { fetchMock, calls } = makeMockFetch('val-id-42');
		vi.stubGlobal('fetch', fetchMock);

		await updateRsvpStatus(cfg, 'rsvp-1', 'late');

		const deleteCall = calls.find((c) => c.method === 'DELETE')!;
		expect(deleteCall.url).toContain('val-id-42');
		// Must be /property/{id}, not /entity/{id}
		expect(deleteCall.url).toContain('property');
		expect(deleteCall.url).not.toMatch(/entity\/val-id-42/);
	});

	it('POST body contains new status string', async () => {
		const { fetchMock, calls } = makeMockFetch();
		vi.stubGlobal('fetch', fetchMock);

		await updateRsvpStatus(cfg, 'rsvp-1', 'late');

		const postCall = calls.find((c) => c.method === 'POST')!;
		const body = postCall.body as Array<{ type: string; string?: string }>;
		expect(body).toEqual(expect.arrayContaining([{ type: 'status', string: 'late' }]));
	});

	it('throws on !ok GET response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(updateRsvpStatus(cfg, 'rsvp-1', 'going')).rejects.toThrow('403');
	});
});

// ── deleteRsvp ────────────────────────────────────────────────────────────────

describe('deleteRsvp', () => {
	it('sends DELETE /entity/{rsvpId}', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);

		await deleteRsvp(cfg, 'rsvp-xyz');

		const call = fetchMock.mock.calls[0] as [string, { method: string }];
		expect(call[0]).toContain('rsvp-xyz');
		expect(call[0]).toContain('entity');
		expect(call[1].method).toBe('DELETE');
	});

	it('throws on !ok response (status surfaced)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(deleteRsvp(cfg, 'rsvp-xyz')).rejects.toThrow('403');
	});
});
