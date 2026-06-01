import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createSeason,
	listSeasons,
	createSeriesWithEvents,
	listRehearsals,
	updateRehearsal,
	deleteRehearsal,
	deleteSeriesCascade,
	listConductors,
	assignConductor,
	revokeConductor,
	DeleteForbiddenError,
} from './entuSeasons';

const cfg = { db: 'testdb', token: 'jwt' };
beforeEach(() => vi.restoreAllMocks());

// ── Task 4: createSeason + listSeasons ────────────────────────────────────────

describe('createSeason', () => {
	it('POSTs the entity with public sharing and returns _id', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue({ ok: true, json: async () => ({ _id: 'season1' }) });
		vi.stubGlobal('fetch', fetchMock);
		const id = await createSeason(cfg, {
			orgId: 'org1',
			name: '2026/27',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
		});
		expect(id).toBe('season1');
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		// Entu create POSTs an array of property objects incl. _type, _parent, _sharing
		expect(body).toEqual(
			expect.arrayContaining([
				{ type: '_type', string: 'season' },
				{ type: '_parent', reference: 'org1' },
				{ type: '_sharing', string: 'public' },
				{ type: 'name', string: '2026/27' },
				{ type: 'start_date', date: '2026-09-01' },
				{ type: 'end_date', date: '2027-05-31' },
			]),
		);
	});

	it('POSTs to the correct Entu entity-create URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _id: 'x' }) });
		vi.stubGlobal('fetch', fetchMock);
		await createSeason(cfg, {
			orgId: 'org1',
			name: 'S',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
		});
		const url: string = fetchMock.mock.calls[0][0];
		expect(url).toContain('testdb');
		expect(url).toContain('entity');
	});

	it('throws when Entu returns ok: false', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(
			createSeason(cfg, {
				orgId: 'org1',
				name: 'S',
				startDate: '2026-09-01',
				endDate: '2027-05-31',
			}),
		).rejects.toThrow();
	});
});

describe('listSeasons', () => {
	it('maps + sorts by startDate', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'b',
							name: [{ string: 'B' }],
							start_date: [{ date: '2027-09-01' }],
							end_date: [{ date: '2028-05-31' }],
						},
						{
							_id: 'a',
							name: [{ string: 'A' }],
							start_date: [{ date: '2026-09-01' }],
							end_date: [{ date: '2027-05-31' }],
						},
					],
				}),
			}),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons.map((s) => s.id)).toEqual(['a', 'b']);
	});

	it('returns [] when Entu returns empty entities', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons).toEqual([]);
	});

	it('includes orgId as _parent.reference filter in query', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) });
		vi.stubGlobal('fetch', fetchMock);
		await listSeasons(cfg, 'myOrg');
		const url: string = fetchMock.mock.calls[0][0];
		expect(url).toContain('myOrg');
	});

	it('maps raw Season fields correctly', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'sea1',
							name: [{ string: 'Autumn 26' }],
							start_date: [{ date: '2026-09-01' }],
							end_date: [{ date: '2027-05-31' }],
						},
					],
				}),
			}),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons[0]).toEqual({
			id: 'sea1',
			name: 'Autumn 26',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
		});
	});
});

// ── Task 5: createSeriesWithEvents (eager generation) ─────────────────────────

describe('createSeriesWithEvents', () => {
	it('generates one event per occurrence with DST-correct datetimes', async () => {
		const calls: unknown[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_u: unknown, init: { body: string }) => {
				calls.push(JSON.parse(init.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `e${calls.length}` }) });
			}),
		);
		const res = await createSeriesWithEvents(
			{ db: 'd', token: 't' },
			{
				orgId: 'org1',
				seasonId: 'season1',
				name: 'Tue',
				intervalDays: 7,
				startTime: '19:00',
				durationMinutes: 120,
				startDate: '2026-09-01',
				endDate: '2026-09-08', // 2 occurrences, Sep = EEST (UTC+3)
			},
		);
		expect(res.eventIds).toHaveLength(2);
		// first POST is the series entity, then 2 event entities
		expect(calls).toHaveLength(3);
		const evDatetimes = (calls as Array<Array<{ type: string; datetime?: string }>>)
			.slice(1)
			.flat()
			.filter((p) => p.type === 'start_datetime')
			.map((p) => p.datetime);
		expect(evDatetimes).toEqual(['2026-09-01T16:00:00.000Z', '2026-09-08T16:00:00.000Z']);
	});

	it('returns seriesId from the first POST response', async () => {
		let callCount = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_u: unknown, _init: unknown) => {
				callCount++;
				return Promise.resolve({
					ok: true,
					json: async () => ({ _id: callCount === 1 ? 'series-abc' : `ev${callCount}` }),
				});
			}),
		);
		const res = await createSeriesWithEvents(
			{ db: 'd', token: 't' },
			{
				orgId: 'o',
				seasonId: 's',
				name: 'N',
				intervalDays: 7,
				startTime: '10:00',
				durationMinutes: 60,
				startDate: '2026-09-01',
				endDate: '2026-09-01', // 1 occurrence
			},
		);
		expect(res.seriesId).toBe('series-abc');
	});

	it('POSTs series with _sharing=private and correct parents', async () => {
		const calls: Array<
			Array<{ type: string; string?: string; reference?: string; number?: number }>
		> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_u: unknown, init: { body: string }) => {
				calls.push(JSON.parse(init.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `id${calls.length}` }) });
			}),
		);
		await createSeriesWithEvents(
			{ db: 'd', token: 't' },
			{
				orgId: 'org1',
				seasonId: 'seas1',
				name: 'Mon',
				intervalDays: 7,
				startTime: '19:00',
				durationMinutes: 90,
				startDate: '2026-09-01',
				endDate: '2026-09-01',
			},
		);
		const seriesProps = calls[0];
		expect(seriesProps).toEqual(
			expect.arrayContaining([
				{ type: '_sharing', string: 'private' },
				{ type: '_parent', reference: 'org1' },
				{ type: '_parent', reference: 'seas1' },
			]),
		);
	});

	it('POSTs events with _sharing=private and all three parents (org+season+series)', async () => {
		const calls: Array<Array<{ type: string; string?: string; reference?: string }>> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_u: unknown, init: { body: string }) => {
				calls.push(JSON.parse(init.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `id${calls.length}` }) });
			}),
		);
		await createSeriesWithEvents(
			{ db: 'd', token: 't' },
			{
				orgId: 'org1',
				seasonId: 'seas1',
				name: 'Mon',
				intervalDays: 7,
				startTime: '19:00',
				durationMinutes: 90,
				startDate: '2026-09-01',
				endDate: '2026-09-01',
			},
		);
		// calls[0] = series, calls[1] = first event
		const seriesId = 'id1'; // returned by first mock call
		const eventProps = calls[1];
		expect(eventProps).toEqual(
			expect.arrayContaining([
				{ type: '_sharing', string: 'private' },
				{ type: '_parent', reference: 'org1' },
				{ type: '_parent', reference: 'seas1' },
				{ type: '_parent', reference: seriesId },
			]),
		);
	});

	it('winter DST: Jan 19:00 EET → 17:00 UTC', async () => {
		const calls: Array<Array<{ type: string; datetime?: string }>> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_u: unknown, init: { body: string }) => {
				calls.push(JSON.parse(init.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `id${calls.length}` }) });
			}),
		);
		await createSeriesWithEvents(
			{ db: 'd', token: 't' },
			{
				orgId: 'o',
				seasonId: 's',
				name: 'N',
				intervalDays: 7,
				startTime: '19:00',
				durationMinutes: 60,
				startDate: '2026-01-06',
				endDate: '2026-01-06', // EET = UTC+2
			},
		);
		const dt = calls[1].find((p) => p.type === 'start_datetime')?.datetime;
		expect(dt).toBe('2026-01-06T17:00:00.000Z');
	});
});

// ── Task 6: listRehearsals (+ read-time inheritance merge) ────────────────────

describe('listRehearsals', () => {
	it('returns rehearsals sorted ascending', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'e2',
							event_type: [{ string: 'rehearsal' }],
							start_datetime: [{ datetime: '2026-09-08T16:00:00.000Z' }],
							_parent: [{ reference: 'series1' }],
						},
						{
							_id: 'e1',
							event_type: [{ string: 'rehearsal' }],
							start_datetime: [{ datetime: '2026-09-01T16:00:00.000Z' }],
							_parent: [{ reference: 'series1' }],
						},
					],
				}),
			}),
		);
		const r = await listRehearsals({ db: 'd', token: 't' }, { orgId: 'org1', seasonId: 'season1' });
		expect(r.map((x) => x.id)).toEqual(['e1', 'e2']);
	});

	it('empty → []', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		expect(await listRehearsals({ db: 'd', token: 't' }, { orgId: 'o', seasonId: 's' })).toEqual(
			[],
		);
	});

	it('merges unset event location from parent series (read-time inheritance, not formula)', async () => {
		// Event e1 has no location; its series has default_location 'Church Hall'.
		// listRehearsals must fetch the series and merge the value in code.
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				// Second fetch: the series lookup
				if (url.includes('/entity/series1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: {
								_id: 'series1',
								default_location: [{ string: 'Church Hall' }],
								duration_minutes: [{ number: 90 }],
							},
						}),
					});
				}
				// First fetch: event search
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entities: [
							{
								_id: 'e1',
								event_type: [{ string: 'rehearsal' }],
								start_datetime: [{ datetime: '2026-09-01T16:00:00.000Z' }],
								// location absent → must be merged from series
								_parent: [{ reference: 'series1' }],
							},
						],
					}),
				});
			}),
		);
		const r = await listRehearsals({ db: 'd', token: 't' }, { orgId: 'org1', seasonId: 'season1' });
		expect(r[0].location).toBe('Church Hall');
	});

	it('event location set explicitly overrides series default', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('/entity/series1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: {
								_id: 'series1',
								default_location: [{ string: 'Series Hall' }],
								duration_minutes: [{ number: 90 }],
							},
						}),
					});
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entities: [
							{
								_id: 'e1',
								event_type: [{ string: 'rehearsal' }],
								start_datetime: [{ datetime: '2026-09-01T16:00:00.000Z' }],
								location: [{ string: 'Override Room' }], // explicitly set on event
								_parent: [{ reference: 'series1' }],
							},
						],
					}),
				});
			}),
		);
		const r = await listRehearsals({ db: 'd', token: 't' }, { orgId: 'org1', seasonId: 'season1' });
		expect(r[0].location).toBe('Override Room');
	});
});

// ── Task 7: updateRehearsal (edit one — DELETE-then-POST replace) ──────────────

describe('updateRehearsal', () => {
	it('patching location issues DELETE of old value then POST of new value', async () => {
		const calls: Array<{ url: string; method?: string; body?: string }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string; body?: string }) => {
				calls.push({ url, method: init?.method ?? 'GET', body: init?.body });
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}),
		);
		await updateRehearsal({ db: 'd', token: 't' }, 'event1', {
			location: { valueId: 'prop-loc-1', value: 'New Room' },
		});
		// Must DELETE the existing property value first
		const del = calls.find((c) => c.method === 'DELETE');
		expect(del?.url).toContain('prop-loc-1');
		// Then POST the new value to the entity
		const post = calls.find((c) => c.method === 'POST');
		expect(post?.url).toContain('event1');
		const body = JSON.parse(post?.body ?? '[]') as Array<{ type: string; string?: string }>;
		expect(body).toEqual(expect.arrayContaining([{ type: 'location', string: 'New Room' }]));
	});

	it('patching one field does not touch siblings (separate entity ids)', async () => {
		// updateRehearsal for event1 must not issue any call to event2's URL
		const urls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, _init?: unknown) => {
				urls.push(url);
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}),
		);
		await updateRehearsal({ db: 'd', token: 't' }, 'event1', {
			location: { valueId: 'prop-loc-1', value: 'New Room' },
		});
		expect(urls.every((u) => !u.includes('event2'))).toBe(true);
	});

	it('patching a field with null valueId (new property) skips the DELETE', async () => {
		const calls: Array<{ method?: string }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url: string, init?: { method?: string }) => {
				calls.push({ method: init?.method ?? 'GET' });
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}),
		);
		// valueId null means the property doesn't exist yet — no DELETE, just POST
		await updateRehearsal({ db: 'd', token: 't' }, 'event1', {
			location: { valueId: null, value: 'New Room' },
		});
		expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
		expect(calls.some((c) => c.method === 'POST')).toBe(true);
	});
});

// ── Task 8: deleteRehearsal (cancel one — _owner-tier) ────────────────────────

describe('deleteRehearsal', () => {
	it('sends DELETE to the correct entity URL', async () => {
		let deletedUrl = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') deletedUrl = url;
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}),
		);
		await deleteRehearsal({ db: 'd', token: 't' }, 'event-abc');
		expect(deletedUrl).toMatch(/entity\/event-abc$/);
	});

	it('throws DeleteForbiddenError on 403 (insufficient tier)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(deleteRehearsal({ db: 'd', token: 't' }, 'event-abc')).rejects.toBeInstanceOf(
			DeleteForbiddenError,
		);
	});

	it('does not delete siblings — only the targeted event id', async () => {
		const deleted: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') deleted.push(url);
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}),
		);
		await deleteRehearsal({ db: 'd', token: 't' }, 'event-xyz');
		expect(deleted).toHaveLength(1);
		expect(deleted[0]).toContain('event-xyz');
	});
});

// ── Task 9: deleteSeriesCascade ───────────────────────────────────────────────

describe('deleteSeriesCascade', () => {
	it('deletes child events filtered to THIS series, then the series', async () => {
		const deleted: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') {
					deleted.push(url);
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				// search: returns children of series1 only
				return Promise.resolve({
					ok: true,
					json: async () => ({ entities: [{ _id: 'e1' }, { _id: 'e2' }] }),
				});
			}),
		);
		const res = await deleteSeriesCascade({ db: 'd', token: 't' }, 'series1');
		expect(res).toEqual({ deleted: 2, seriesDeleted: true });
		expect(deleted.some((u) => u.endsWith('/entity/series1'))).toBe(true);
		expect(deleted.filter((u) => /\/entity\/e[12]$/.test(u))).toHaveLength(2);
	});

	it('partial failure keeps the series', async () => {
		let n = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_u: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') {
					n++;
					return Promise.resolve({ ok: n === 1, json: async () => ({}) });
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entities: [{ _id: 'e1' }, { _id: 'e2' }] }),
				});
			}),
		);
		const res = await deleteSeriesCascade({ db: 'd', token: 't' }, 'series1');
		expect(res.seriesDeleted).toBe(false);
		expect(res.deleted).toBe(1);
	});

	it('children-search query is filtered by series id (not just season)', async () => {
		// This guards against sweeping sibling-series events that share the same season parent.
		// The query MUST include _parent.reference=series1 (and _type.string=event).
		let searchUrl = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method !== 'DELETE') searchUrl = url;
				return Promise.resolve({ ok: true, json: async () => ({ entities: [] }) });
			}),
		);
		await deleteSeriesCascade({ db: 'd', token: 't' }, 'series1');
		// Both filters must appear in the children search URL
		expect(searchUrl).toContain('series1');
		expect(searchUrl.toLowerCase()).toContain('_type');
	});
});

// ── Task 10: conductor grant/revoke/list ──────────────────────────────────────

describe('listConductors', () => {
	// P0.3: the `_editor` GET field is a FLATTENED rights view mixing _owner + _editor
	// entries. Filter: property_type === '_editor' AND inherited !== true.
	// A bare `!inherited` guard would wrongly admit the direct-_owner entry.
	it('returns direct _editor grantees, excluding inherited entries and direct _owner', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('/entity/season1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: {
								_id: 'season1',
								_editor: [
									{ reference: 'p_admin', property_type: '_owner', inherited: true }, // cascaded org-owner → excluded
									{ reference: 'p_self', property_type: '_owner' }, // direct _owner, no `inherited` → still excluded
									{ _id: 'editor-value-1', reference: 'p_cond', property_type: '_editor' }, // direct conductor (inherited ABSENT) → included
								],
							},
						}),
					});
				}
				// person name resolution for p_cond
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: { _id: 'p_cond', name: [{ string: 'Jane C.' }] },
					}),
				});
			}),
		);
		const list = await listConductors({ db: 'd', token: 't' }, 'season1');
		// propertyValueId is the _editor entry's _id — needed by revokeConductor (YELLOW-D1)
		expect(list).toEqual([
			{ personId: 'p_cond', name: 'Jane C.', propertyValueId: 'editor-value-1' },
		]);
	});

	it('returns empty array when no direct _editor entries exist', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('/entity/season1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: {
								_id: 'season1',
								_editor: [{ reference: 'p_admin', property_type: '_owner', inherited: true }],
							},
						}),
					});
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'x', name: [] } }),
				});
			}),
		);
		const list = await listConductors({ db: 'd', token: 't' }, 'season1');
		expect(list).toEqual([]);
	});

	it('resolves each conductor name via a separate GET /entity/{personId} (single-hop)', async () => {
		const fetched: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				fetched.push(url);
				if (url.includes('/entity/season1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: {
								_id: 'season1',
								_editor: [
									{ reference: 'p1', property_type: '_editor' },
									{ reference: 'p2', property_type: '_editor' },
								],
							},
						}),
					});
				}
				if (url.includes('/entity/p1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entity: { _id: 'p1', name: [{ string: 'Alice' }] } }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'p2', name: [{ string: 'Bob' }] } }),
				});
			}),
		);
		const list = await listConductors({ db: 'd', token: 't' }, 'season1');
		expect(list).toHaveLength(2);
		expect(list.map((c) => c.name).sort()).toEqual(['Alice', 'Bob']);
		// Must fetch each person entity separately (single-hop per Cap7)
		expect(fetched.some((u) => u.includes('/entity/p1'))).toBe(true);
		expect(fetched.some((u) => u.includes('/entity/p2'))).toBe(true);
	});
});

describe('assignConductor', () => {
	it('refuses a non-member: throws /must be an org member/ when member search returns empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		await expect(
			assignConductor(
				{ db: 'd', token: 't' },
				{ seasonId: 'season1', orgId: 'org1', personId: 'p_x' },
			),
		).rejects.toThrow(/must be an org member/);
	});

	it('POSTs _editor reference to the season when person is an active member', async () => {
		const posts: Array<{ url: string; body: unknown }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string; body?: string }) => {
				if (init?.method === 'POST') {
					posts.push({ url, body: JSON.parse(init.body ?? '[]') });
					return Promise.resolve({ ok: true, json: async () => ({ _id: 'new-prop' }) });
				}
				// member search — returns one active member
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'mem1' }] }) });
			}),
		);
		await assignConductor(
			{ db: 'd', token: 't' },
			{ seasonId: 'season1', orgId: 'org1', personId: 'p_cond' },
		);
		expect(posts).toHaveLength(1);
		expect(posts[0].url).toContain('season1');
		const body = posts[0].body as Array<{ type: string; reference?: string }>;
		expect(body).toEqual(expect.arrayContaining([{ type: '_editor', reference: 'p_cond' }]));
	});
});

describe('revokeConductor', () => {
	it('DELETEs the _editor property VALUE by propertyValueId (not the person entity)', async () => {
		const deleted: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') deleted.push(url);
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}),
		);
		await revokeConductor(
			{ db: 'd', token: 't' },
			{ seasonId: 'season1', propertyValueId: 'prop-val-42' },
		);
		// Wire shape: DELETE /property/{propertyValueId} (not /entity/)
		expect(deleted).toHaveLength(1);
		expect(deleted[0]).toContain('prop-val-42');
	});
});
