import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createSeason,
	listSeasons,
	createSeriesWithEvents,
	listRehearsals,
	updateRehearsal,
	updateSeason,
	deleteRehearsal,
	deleteSeriesCascade,
	listConductors,
	assignConductor,
	revokeConductor,
	listOrgMembers,
	listSeries,
	DeleteForbiddenError,
	resolveTypeId,
	resetTypeIdCache,
} from './entuSeasons';

const cfg = { db: 'testdb', token: 'jwt' };
beforeEach(() => vi.restoreAllMocks());

// ── resolveTypeId ───────────────────────────────────────────────────────────

describe('resolveTypeId', () => {
	beforeEach(() => resetTypeIdCache());

	it('fetches the type-definition entity by name and returns its _id', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ entities: [{ _id: 'type-season-id' }], count: 1 }),
			}),
		);
		const id = await resolveTypeId(cfg, 'season');
		expect(id).toBe('type-season-id');
		const url: string = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(url).toContain('_type.string=entity');
		expect(url).toContain('name.string=season');
		expect(url).toContain('testdb');
	});

	it('memoizes: second call with same db+typeName does NOT fetch again', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [{ _id: 'cached-id' }], count: 1 }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await resolveTypeId(cfg, 'event');
		await resolveTypeId(cfg, 'event');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('different db produces a separate cache entry', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [{ _id: 'id-for-db' }], count: 1 }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await resolveTypeId({ db: 'db-a', token: 't' }, 'season');
		await resolveTypeId({ db: 'db-b', token: 't' }, 'season');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('throws when no type-definition entity is found', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ entities: [], count: 0 }),
			}),
		);
		await expect(resolveTypeId(cfg, 'nonexistent')).rejects.toThrow(
			"type definition not found: 'nonexistent' in db 'testdb'",
		);
	});
});

// ── Task 4: createSeason + listSeasons ────────────────────────────────────────

describe('createSeason', () => {
	it('POSTs the entity with public sharing and returns _id', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ entities: [{ _id: 'resolved-season-type' }] }),
				});
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: 'season1' }) });
		});
		vi.stubGlobal('fetch', fetchMock);
		resetTypeIdCache();
		const id = await createSeason(cfg, {
			orgId: 'org1',
			name: '2026/27',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
		});
		expect(id).toBe('season1');
		const createCall = fetchMock.mock.calls.find(
			(c) => !(c[0] as string).includes('_type.string=entity'),
		)!;
		const body = JSON.parse((createCall[1] as { body: string }).body);
		expect(body).toEqual(
			expect.arrayContaining([
				{ type: '_type', reference: 'resolved-season-type' },
				{ type: '_parent', reference: 'org1' },
				{ type: '_sharing', string: 'public' },
				{ type: 'name', string: '2026/27' },
				{ type: 'start_date', date: '2026-09-01' },
				{ type: 'end_date', date: '2027-05-31' },
			]),
		);
	});

	it('POSTs to the correct Entu entity-create URL', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ entities: [{ _id: 'type-id' }] }),
				});
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: 'x' }) });
		});
		vi.stubGlobal('fetch', fetchMock);
		resetTypeIdCache();
		await createSeason(cfg, {
			orgId: 'org1',
			name: 'S',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
		});
		const createCall = fetchMock.mock.calls.find(
			(c) => !(c[0] as string).includes('_type.string=entity'),
		)!;
		const url: string = createCall[0] as string;
		expect(url).toContain('testdb');
		expect(url).toContain('entity');
	});

	it('throws when Entu returns ok: false', async () => {
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
		resetTypeIdCache();
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

	it('maps description from raw Season (description round-trip — RED-MOB.1)', async () => {
		// listSeasons must fetch + map the description field so it round-trips to
		// SeasonForm edit mode. Without this, description is always undefined and
		// the form pre-fills '' → patch wipes the description on save.
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
							description: [{ string: 'Our autumn concert season' }],
						},
					],
				}),
			}),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons[0].description).toBe('Our autumn concert season');
	});

	it('listSeasons query includes description in props', async () => {
		let searchUrl = '';
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			searchUrl = url;
			return Promise.resolve({ ok: true, json: async () => ({ entities: [] }) });
		}));
		await listSeasons(cfg, 'org1');
		expect(searchUrl).toContain('description');
	});

	// ── Date normalization bug (live probe Pérotin 2026-06-01) ────────────────
	// Entu returns date-typed values as full ISO strings ("2026-06-02T00:00:00.000Z"),
	// NOT as bare date strings ("2026-06-02"). listSeasons must normalize to YYYY-MM-DD
	// before returning, otherwise <input type="date"> receives the full ISO and renders blank.

	it('normalizes Entu ISO date strings to YYYY-MM-DD (fix/season-date-format)', async () => {
		// Drive the REAL producer with the REAL Entu wire format (probed 2026-06-01).
		// Full-shape toEqual — no objectContaining shortcuts (feedback_partial_assertions_hide_bugs).
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'sea-live',
							name: [{ string: 'Fooz' }],
							start_date: [{ _id: 'v1', date: '2026-06-02T00:00:00.000Z' }],
							end_date: [{ _id: 'v2', date: '2026-07-28T00:00:00.000Z' }],
						},
					],
				}),
			}),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons[0]).toEqual({
			id: 'sea-live',
			name: 'Fooz',
			startDate: '2026-06-02',
			endDate: '2026-07-28',
		});
	});

	it('slice is idempotent: already-clean YYYY-MM-DD date passes through unchanged', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'sea2',
							name: [{ string: 'Clean' }],
							start_date: [{ date: '2027-01-15' }],
							end_date: [{ date: '2027-06-30' }],
						},
					],
				}),
			}),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons[0].startDate).toBe('2027-01-15');
		expect(seasons[0].endDate).toBe('2027-06-30');
	});

	it('missing date field maps to empty string (existing ?? "" preserved)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'sea3',
							name: [{ string: 'Incomplete' }],
							// start_date and end_date absent
						},
					],
				}),
			}),
		);
		const seasons = await listSeasons(cfg, 'org1');
		expect(seasons[0].startDate).toBe('');
		expect(seasons[0].endDate).toBe('');
	});
});

// ── Task 5: createSeriesWithEvents (eager generation) ─────────────────────────

describe('createSeriesWithEvents', () => {
	it('generates one event per occurrence with DST-correct datetimes', async () => {
		resetTypeIdCache();
		const createCalls: unknown[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { body: string }) => {
				if (url.includes('_type.string=entity')) {
					const typeName = url.match(/name\.string=([^&]+)/)?.[1] ?? '';
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: `resolved-${typeName}` }] }),
					});
				}
				createCalls.push(JSON.parse(init!.body));
				return Promise.resolve({
					ok: true,
					json: async () => ({ _id: `e${createCalls.length}` }),
				});
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
				endDate: '2026-09-08',
			},
		);
		expect(res.eventIds).toHaveLength(2);
		expect(createCalls).toHaveLength(3);
		const evDatetimes = (createCalls as Array<Array<{ type: string; datetime?: string }>>)
			.slice(1)
			.flat()
			.filter((p) => p.type === 'start_datetime')
			.map((p) => p.datetime);
		expect(evDatetimes).toEqual(['2026-09-01T16:00:00.000Z', '2026-09-08T16:00:00.000Z']);
	});

	it('returns seriesId from the first POST response', async () => {
		resetTypeIdCache();
		let createCount = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('_type.string=entity')) {
					const typeName = url.match(/name\.string=([^&]+)/)?.[1] ?? '';
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: `resolved-${typeName}` }] }),
					});
				}
				createCount++;
				return Promise.resolve({
					ok: true,
					json: async () => ({ _id: createCount === 1 ? 'series-abc' : `ev${createCount}` }),
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
				endDate: '2026-09-01',
			},
		);
		expect(res.seriesId).toBe('series-abc');
	});

	it('POSTs series with _sharing=private and correct parents', async () => {
		resetTypeIdCache();
		const createCalls: Array<
			Array<{ type: string; string?: string; reference?: string; number?: number }>
		> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { body: string }) => {
				if (url.includes('_type.string=entity')) {
					const typeName = url.match(/name\.string=([^&]+)/)?.[1] ?? '';
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: `resolved-${typeName}` }] }),
					});
				}
				createCalls.push(JSON.parse(init!.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `id${createCalls.length}` }) });
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
		const seriesProps = createCalls[0];
		expect(seriesProps).toEqual(
			expect.arrayContaining([
				{ type: '_type', reference: 'resolved-event_series' },
				{ type: '_sharing', string: 'private' },
				{ type: '_parent', reference: 'org1' },
				{ type: '_parent', reference: 'seas1' },
			]),
		);
	});

	it('POSTs events with _sharing=private and all three parents (org+season+series)', async () => {
		resetTypeIdCache();
		const createCalls: Array<Array<{ type: string; string?: string; reference?: string }>> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { body: string }) => {
				if (url.includes('_type.string=entity')) {
					const typeName = url.match(/name\.string=([^&]+)/)?.[1] ?? '';
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: `resolved-${typeName}` }] }),
					});
				}
				createCalls.push(JSON.parse(init!.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `id${createCalls.length}` }) });
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
		const seriesId = 'id1';
		const eventProps = createCalls[1];
		expect(eventProps).toEqual(
			expect.arrayContaining([
				{ type: '_type', reference: 'resolved-event' },
				{ type: '_sharing', string: 'private' },
				{ type: '_parent', reference: 'org1' },
				{ type: '_parent', reference: 'seas1' },
				{ type: '_parent', reference: seriesId },
			]),
		);
	});

	it('winter DST: Jan 19:00 EET → 17:00 UTC', async () => {
		resetTypeIdCache();
		const createCalls: Array<Array<{ type: string; datetime?: string }>> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { body: string }) => {
				if (url.includes('_type.string=entity')) {
					const typeName = url.match(/name\.string=([^&]+)/)?.[1] ?? '';
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: `resolved-${typeName}` }] }),
					});
				}
				createCalls.push(JSON.parse(init!.body));
				return Promise.resolve({ ok: true, json: async () => ({ _id: `id${createCalls.length}` }) });
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
				endDate: '2026-01-06',
			},
		);
		const dt = createCalls[1].find((p) => p.type === 'start_datetime')?.datetime;
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

// ── Task 7: updateRehearsal (edit one — DELETE-then-POST replace) ────────────
//
// UPDATED IN #87: old tests used the value-id caller contract; new contract is
// self-resolving (plain values only — mirroring updateSeason). These three tests
// are replaced/superseded by the #87 describe block below; kept here in condensed
// form for regression coverage of the basic path.

describe('updateRehearsal (Task 7, updated for self-resolving contract — #87)', () => {
	it('patching location: GET event, DELETE old value-id, POST new value', async () => {
		// Self-resolving: caller passes plain value; fn must GET event to find value-id.
		const calls: Array<{ url: string; method?: string; body?: string }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string; body?: string }) => {
				calls.push({ url, method: init?.method ?? 'GET', body: init?.body });
				if (init?.method === 'DELETE' || init?.method === 'POST') {
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				// GET event: return entity with existing location value-id
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: { _id: 'event1', location: [{ _id: 'prop-loc-1', string: 'Old Room' }] },
					}),
				});
			}),
		);
		await updateRehearsal({ db: 'd', token: 't' }, 'event1', { location: 'New Room' });
		// Must DELETE the resolved property value
		const del = calls.find((c) => c.method === 'DELETE');
		expect(del?.url).toContain('prop-loc-1');
		// Then POST the new value to the entity
		const post = calls.find((c) => c.method === 'POST');
		expect(post?.url).toContain('event1');
		const body = JSON.parse(post?.body ?? '[]') as Array<{ type: string; string?: string }>;
		expect(body).toEqual(expect.arrayContaining([{ type: 'location', string: 'New Room' }]));
	});

	it('patching one field does not touch sibling entity ids', async () => {
		// updateRehearsal for event1 must not issue any call to event2's URL
		const urls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				urls.push(url);
				if (init?.method === 'DELETE' || init?.method === 'POST') {
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'event1', location: [{ _id: 'lv-1' }] } }),
				});
			}),
		);
		await updateRehearsal({ db: 'd', token: 't' }, 'event1', { location: 'New Room' });
		expect(urls.every((u) => !u.includes('event2'))).toBe(true);
	});

	it('field absent from entity (new property): skip DELETE, only POST', async () => {
		// Entity has no existing location → no DELETE, just POST the new value.
		const calls: Array<{ method?: string }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url: string, init?: { method?: string }) => {
				calls.push({ method: init?.method ?? 'GET' });
				return Promise.resolve({
					ok: true,
					json: async () => ({
						// location absent — new property, no value-id to delete
						entity: { _id: 'event1' },
					}),
				});
			}),
		);
		await updateRehearsal({ db: 'd', token: 't' }, 'event1', { location: 'New Room' });
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
		// propertyValueId dropped — revoke now goes by personId (all grants for that person)
		expect(list).toEqual([{ personId: 'p_cond', name: 'Jane C.' }]);
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

	it('idempotent — skips POST if personId already has an _editor grant on the season', async () => {
		// p_cond is already in _editor; assignConductor must NOT post a second grant.
		const posts: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'POST') posts.push(url);
				// member search — found
				if (url.includes('_type.string=member')) {
					return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'mem1' }] }) });
				}
				// season GET — already has p_cond as _editor
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: {
							_id: 'season1',
							_editor: [{ _id: 'ev-1', reference: 'p_cond', property_type: '_editor' }],
						},
					}),
				});
			}),
		);
		await assignConductor(
			{ db: 'd', token: 't' },
			{ seasonId: 'season1', orgId: 'org1', personId: 'p_cond' },
		);
		// No POST should be issued because p_cond already has a grant
		expect(posts).toHaveLength(0);
	});
});

describe('listConductors — dedupe', () => {
	it('returns ONE entry per person even when Entu has multiple _editor grants', async () => {
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
									{ _id: 'ev-1', reference: 'p_cond', property_type: '_editor' }, // grant 1
									{ _id: 'ev-2', reference: 'p_cond', property_type: '_editor' }, // duplicate
									{ _id: 'ev-3', reference: 'p_other', property_type: '_editor' }, // different person
								],
							},
						}),
					});
				}
				if (url.includes('/entity/p_cond')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entity: { _id: 'p_cond', name: [{ string: 'Jane C.' }] } }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'p_other', name: [{ string: 'Bob O.' }] } }),
				});
			}),
		);
		const list = await listConductors({ db: 'd', token: 't' }, 'season1');
		// Only one entry for p_cond despite two grants; plus one for p_other
		expect(list).toHaveLength(2);
		expect(list.filter((c) => c.personId === 'p_cond')).toHaveLength(1);
	});
});

describe('revokeConductor', () => {
	it('DELETEs ALL _editor property-value entries for the given personId', async () => {
		// Person p_cond has 3 _editor grants (duplicate from double-assign bug).
		// revokeConductor must DELETE all 3.
		const deleted: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') {
					deleted.push(url);
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				// GET season: return 3 _editor entries for p_cond
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: {
							_id: 'season1',
							_editor: [
								{ _id: 'ev-1', reference: 'p_cond', property_type: '_editor' },
								{ _id: 'ev-2', reference: 'p_cond', property_type: '_editor' }, // duplicate
								{ _id: 'ev-3', reference: 'p_cond', property_type: '_editor' }, // duplicate
								{ _id: 'ev-4', reference: 'p_other', property_type: '_editor' }, // different person — untouched
							],
						},
					}),
				});
			}),
		);

		await revokeConductor({ db: 'd', token: 't' }, { seasonId: 'season1', personId: 'p_cond' });

		// Must have issued exactly 3 DELETEs — one per p_cond's grant; p_other untouched
		expect(deleted).toHaveLength(3);
		expect(
			deleted.every((u) => u.includes('ev-1') || u.includes('ev-2') || u.includes('ev-3')),
		).toBe(true);
		expect(deleted.some((u) => u.includes('ev-4'))).toBe(false);
	});

	it('revokes only property-value entries (DELETE /property/{id}, not /entity/)', async () => {
		const deleted: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
				if (init?.method === 'DELETE') deleted.push(url);
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: {
							_id: 'season1',
							_editor: [{ _id: 'ev-x', reference: 'p1', property_type: '_editor' }],
						},
					}),
				});
			}),
		);

		await revokeConductor({ db: 'd', token: 't' }, { seasonId: 'season1', personId: 'p1' });

		// Wire shape: DELETE /property/{id} not /entity/{id}
		expect(deleted).toHaveLength(1);
		expect(deleted[0]).toContain('/property/');
		expect(deleted[0]).not.toContain('/entity/');
	});
});

// ── T1: listOrgMembers (#86) ──────────────────────────────────────────────────

describe('listOrgMembers', () => {
	it('queries active members under orgId and resolves names via per-person GET', async () => {
		const fetched: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				fetched.push(url);
				// Member search response — two active members
				if (url.includes('_type.string=member')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entities: [
								{ _id: 'm1', person: [{ reference: 'p1' }] },
								{ _id: 'm2', person: [{ reference: 'p2' }] },
							],
						}),
					});
				}
				// Per-person name resolution
				if (url.includes('/entity/p1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entity: { _id: 'p1', name: [{ string: 'Alice A.' }] } }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'p2', name: [{ string: 'Bob B.' }] } }),
				});
			}),
		);

		const members = await listOrgMembers({ db: 'd', token: 't' }, 'org1');

		expect(members).toHaveLength(2);
		expect(members.map((m) => m.name).sort()).toEqual(['Alice A.', 'Bob B.']);
		expect(members.map((m) => m.personId).sort()).toEqual(['p1', 'p2']);
	});

	it('query string carries status.string=active and _parent.reference=orgId', async () => {
		let searchUrl = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('_type.string=member')) searchUrl = url;
				return Promise.resolve({ ok: true, json: async () => ({ entities: [] }) });
			}),
		);

		await listOrgMembers({ db: 'd', token: 't' }, 'myOrg');

		expect(searchUrl).toContain('status.string=active');
		expect(searchUrl).toContain('myOrg');
		expect(searchUrl).toContain('_type.string=member');
	});

	it('empty member search → []', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ entities: [] }),
			}),
		);

		const members = await listOrgMembers({ db: 'd', token: 't' }, 'org1');
		expect(members).toEqual([]);
	});

	it('resolves each person name via a separate GET /entity/{personId} (single-hop)', async () => {
		const fetched: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				fetched.push(url);
				if (url.includes('_type.string=member')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'm1', person: [{ reference: 'px' }] }] }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'px', name: [{ string: 'Carol C.' }] } }),
				});
			}),
		);

		await listOrgMembers({ db: 'd', token: 't' }, 'org1');

		// Must have fetched the person entity by id (single-hop name resolution)
		expect(fetched.some((u) => u.includes('/entity/px'))).toBe(true);
	});
});

// ── T3: listSeries (#86) ──────────────────────────────────────────────────────

describe('listSeries', () => {
	it('queries event_series under seasonId and maps to RehearsalSeries[]', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'ser1',
							name: [{ string: 'Tuesday Evening' }],
							interval_days: [{ number: 7 }],
							start_time: [{ string: '19:00' }],
							duration_minutes: [{ number: 90 }],
							start_date: [{ date: '2026-09-02' }],
							end_date: [{ date: '2027-05-30' }],
						},
					],
				}),
			}),
		);

		const series = await listSeries({ db: 'd', token: 't' }, 'season1');

		expect(series).toHaveLength(1);
		expect(series[0].id).toBe('ser1');
		expect(series[0].name).toBe('Tuesday Evening');
	});

	it('query string carries _type.string=event_series and _parent.reference=seasonId', async () => {
		let searchUrl = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				searchUrl = url;
				return Promise.resolve({ ok: true, json: async () => ({ entities: [] }) });
			}),
		);

		await listSeries({ db: 'd', token: 't' }, 'mySeason');

		expect(searchUrl).toContain('_type.string=event_series');
		expect(searchUrl).toContain('mySeason');
	});

	it('empty → []', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		const series = await listSeries({ db: 'd', token: 't' }, 'season1');
		expect(series).toEqual([]);
	});
});

// ── updateSeason (self-resolving clear-then-set) ──────────────────────────────

describe('updateSeason', () => {
	/** Build a mock fetch that returns a season entity with given value-ids,
	 *  records DELETEs and POSTs, and resolves all calls successfully. */
	function makeMockFetch(nameValueId = 'nv-1', startValueId = 'sv-1', endValueId = 'ev-1') {
		const deleted: string[] = [];
		const posts: Array<{ url: string; body: unknown }> = [];
		const fetchMock = vi
			.fn()
			.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
				if (init?.method === 'DELETE') {
					deleted.push(url);
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				if (init?.method === 'POST') {
					posts.push({ url, body: JSON.parse(init.body ?? '[]') });
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				// GET season — return entity with existing value-ids
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: {
							_id: 'season1',
							name: [{ _id: nameValueId, string: 'Old Name' }],
							start_date: [{ _id: startValueId, date: '2026-09-01' }],
							end_date: [{ _id: endValueId, date: '2027-05-31' }],
						},
					}),
				});
			});
		return { fetchMock, deleted, posts };
	}

	it('patching name → DELETE old name value then POST new name; other fields untouched', async () => {
		const { fetchMock, deleted, posts } = makeMockFetch();
		vi.stubGlobal('fetch', fetchMock);

		await updateSeason({ db: 'd', token: 't' }, 'season1', { name: 'Autumn 2027' });

		// Must DELETE the existing name property value
		expect(deleted).toHaveLength(1);
		expect(deleted[0]).toContain('nv-1');
		// Must POST the new name value to the season entity
		expect(posts).toHaveLength(1);
		expect(posts[0].url).toContain('season1');
		const body = posts[0].body as Array<{ type: string; string?: string }>;
		expect(body).toEqual(expect.arrayContaining([{ type: 'name', string: 'Autumn 2027' }]));
		// start_date and end_date must NOT be touched
		expect(deleted.some((u) => u.includes('sv-1') || u.includes('ev-1'))).toBe(false);
	});

	it('patching multiple fields → DELETE+POST each independently', async () => {
		const { fetchMock, deleted, posts } = makeMockFetch('nv-x', 'sv-x', 'ev-x');
		vi.stubGlobal('fetch', fetchMock);

		await updateSeason({ db: 'd', token: 't' }, 'season1', {
			name: 'New Name',
			startDate: '2026-10-01',
		});

		// 2 DELETEs (name + start_date), 2 POSTs
		expect(deleted).toHaveLength(2);
		expect(deleted.some((u) => u.includes('nv-x'))).toBe(true);
		expect(deleted.some((u) => u.includes('sv-x'))).toBe(true);
		expect(posts).toHaveLength(2);
		// end_date NOT touched
		expect(deleted.some((u) => u.includes('ev-x'))).toBe(false);
	});

	it('empty patch → no DELETE or POST (GET-only, no mutations)', async () => {
		const { fetchMock, deleted, posts } = makeMockFetch();
		vi.stubGlobal('fetch', fetchMock);

		await updateSeason({ db: 'd', token: 't' }, 'season1', {});

		expect(deleted).toHaveLength(0);
		expect(posts).toHaveLength(0);
	});

	it('GET uses the seasonId in the URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entity: { _id: 'sea-abc', name: [], start_date: [], end_date: [] } }),
		});
		vi.stubGlobal('fetch', fetchMock);

		await updateSeason({ db: 'd', token: 't' }, 'sea-abc', { name: 'X' }).catch(() => {});
		// First call must be a GET to the season entity (self-resolve step)
		const firstUrl: string = fetchMock.mock.calls[0][0];
		expect(firstUrl).toContain('sea-abc');
	});

	it('maps field names correctly: startDate→start_date, endDate→end_date', async () => {
		const { fetchMock, posts } = makeMockFetch('nv-2', 'sv-2', 'ev-2');
		vi.stubGlobal('fetch', fetchMock);

		await updateSeason({ db: 'd', token: 't' }, 'season1', {
			startDate: '2026-10-01',
			endDate: '2027-06-01',
		});

		const allProps = posts.flatMap((p) => p.body as Array<{ type: string; date?: string }>);
		expect(allProps.some((p) => p.type === 'start_date')).toBe(true);
		expect(allProps.some((p) => p.type === 'end_date')).toBe(true);
		// Must not use camelCase property names
		expect(allProps.some((p) => p.type === 'startDate' || p.type === 'endDate')).toBe(false);
	});
});

// ── #87: listRehearsals description mapping ───────────────────────────────────

describe('listRehearsals — description field (#87)', () => {
	it('maps description from event raw data onto Rehearsal', async () => {
		// Rehearsal.description must be carried through from the raw event's
		// description property. Without this mapping the edit form can't pre-fill it.
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('/entity/series1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: { _id: 'series1', duration_minutes: [{ number: 90 }] },
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
								duration_minutes: [{ number: 90 }],
								description: [{ _id: 'desc-val-1', string: 'Bring scores' }],
								_parent: [{ reference: 'series1' }],
							},
						],
					}),
				});
			}),
		);
		const r = await listRehearsals({ db: 'd', token: 't' }, { orgId: 'org1', seasonId: 'season1' });
		expect(r[0].description).toBe('Bring scores');
	});

	it('description is undefined when the event has no description property', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('/entity/series1')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({
							entity: { _id: 'series1', duration_minutes: [{ number: 90 }] },
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
								duration_minutes: [{ number: 90 }],
								// description absent — must map to undefined, not ''
								_parent: [{ reference: 'series1' }],
							},
						],
					}),
				});
			}),
		);
		const r = await listRehearsals({ db: 'd', token: 't' }, { orgId: 'org1', seasonId: 'season1' });
		expect(r[0].description).toBeUndefined();
	});

	it('listRehearsals query props param includes description', async () => {
		// The search URL must request the description field so Entu returns it.
		let searchUrl = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (!url.includes('/entity/')) {
					// entity search (not entity/{id})
					searchUrl = url;
				}
				return Promise.resolve({ ok: true, json: async () => ({ entities: [] }) });
			}),
		);
		await listRehearsals({ db: 'd', token: 't' }, { orgId: 'o', seasonId: 's' });
		expect(searchUrl).toContain('description');
	});
});

// ── #87: updateRehearsal self-resolving refactor ──────────────────────────────
//
// Design decision (team-lead, option (a)): updateRehearsal self-resolves value-ids,
// mirroring updateSeason. New caller contract = plain values, no value-ids.
// Internally: GET event → find existing property-value _id for each patched field →
// DELETE old value → POST new value. Fields absent from patch are NOT touched.
//
// This is the AC "integration test driving the REAL update path (mock fetch, NOT helper)".

describe('updateRehearsal (#87) — self-resolving contract', () => {
	/**
	 * Build a mock fetch that returns an event entity carrying the given value-ids,
	 * records DELETEs and POSTs, and resolves all calls successfully.
	 */
	function makeRehearsalFetch(opts: {
		startDatetimeValueId?: string;
		durationValueId?: string;
		locationValueId?: string;
		descriptionValueId?: string;
	} = {}) {
		const deleted: string[] = [];
		const posts: Array<{ url: string; body: unknown }> = [];
		const fetchMock = vi
			.fn()
			.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
				if (init?.method === 'DELETE') {
					deleted.push(url);
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				if (init?.method === 'POST') {
					posts.push({ url, body: JSON.parse(init.body ?? '[]') });
					return Promise.resolve({ ok: true, json: async () => ({}) });
				}
				// GET event — return entity with existing value-ids per opts
				const entity: Record<string, Array<{ _id: string }>> = {};
				if (opts.startDatetimeValueId) {
					entity['start_datetime'] = [{ _id: opts.startDatetimeValueId }];
				}
				if (opts.durationValueId) {
					entity['duration_minutes'] = [{ _id: opts.durationValueId }];
				}
				if (opts.locationValueId) {
					entity['location'] = [{ _id: opts.locationValueId }];
				}
				if (opts.descriptionValueId) {
					entity['description'] = [{ _id: opts.descriptionValueId }];
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'event-x', ...entity } }),
				});
			});
		return { fetchMock, deleted, posts };
	}

	it('single-field patch: 1 GET (event), 1 DELETE (resolved value-id), 1 POST; other fields untouched', async () => {
		// Patch only start_datetime — must NOT touch duration/location/description.
		const { fetchMock, deleted, posts } = makeRehearsalFetch({
			startDatetimeValueId: 'sdt-val-1',
			durationValueId: 'dur-val-1',
			locationValueId: 'loc-val-1',
			descriptionValueId: 'desc-val-1',
		});
		vi.stubGlobal('fetch', fetchMock);

		await updateRehearsal({ db: 'd', token: 't' }, 'event1', {
			start_datetime: '2026-09-08T16:00:00.000Z',
		});

		// Exactly 1 GET to self-resolve (calls without a method or with method 'GET')
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const gets = (fetchMock.mock.calls as any[]).filter(
			(c: unknown[]) => !(c[1] as { method?: string } | undefined)?.method,
		);
		expect(gets).toHaveLength(1);
		expect((gets[0][0] as string)).toContain('event1');

		// DELETE must target the resolved start_datetime value-id
		expect(deleted).toHaveLength(1);
		expect(deleted[0]).toContain('sdt-val-1');

		// POST must carry the new start_datetime value
		expect(posts).toHaveLength(1);
		expect(posts[0].url).toContain('event1');
		const body = posts[0].body as Array<{ type: string; datetime?: string }>;
		expect(body).toEqual(
			expect.arrayContaining([{ type: 'start_datetime', datetime: '2026-09-08T16:00:00.000Z' }]),
		);

		// duration/location/description value-ids must NOT be DELETEd
		expect(deleted.some((u) => u.includes('dur-val-1'))).toBe(false);
		expect(deleted.some((u) => u.includes('loc-val-1'))).toBe(false);
		expect(deleted.some((u) => u.includes('desc-val-1'))).toBe(false);
	});

	it('multi-field patch: 1 GET, DELETE+POST each patched field; absent fields untouched', async () => {
		// Patch start_datetime + location → 1 GET, 2 DELETEs, 2 POSTs.
		// duration + description absent from patch → NOT touched.
		const { fetchMock, deleted, posts } = makeRehearsalFetch({
			startDatetimeValueId: 'sdt-val-2',
			durationValueId: 'dur-val-2',
			locationValueId: 'loc-val-2',
			descriptionValueId: 'desc-val-2',
		});
		vi.stubGlobal('fetch', fetchMock);

		await updateRehearsal({ db: 'd', token: 't' }, 'event2', {
			start_datetime: '2026-09-15T16:00:00.000Z',
			location: 'New Hall',
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const gets = (fetchMock.mock.calls as any[]).filter(
			(c: unknown[]) => !(c[1] as { method?: string } | undefined)?.method,
		);
		expect(gets).toHaveLength(1);
		expect(deleted).toHaveLength(2);
		expect(deleted.some((u) => u.includes('sdt-val-2'))).toBe(true);
		expect(deleted.some((u) => u.includes('loc-val-2'))).toBe(true);
		expect(posts).toHaveLength(2);
		// duration + description untouched
		expect(deleted.some((u) => u.includes('dur-val-2'))).toBe(false);
		expect(deleted.some((u) => u.includes('desc-val-2'))).toBe(false);
	});

	it('field absent from entity (new property): skip DELETE, only POST', async () => {
		// location not on entity yet → no DELETE, only POST the new value
		const { fetchMock, deleted, posts } = makeRehearsalFetch({
			startDatetimeValueId: 'sdt-val-3',
			// locationValueId absent — entity has no location to clear
		});
		vi.stubGlobal('fetch', fetchMock);

		await updateRehearsal({ db: 'd', token: 't' }, 'event3', { location: 'First Location' });

		expect(deleted).toHaveLength(0);
		expect(posts).toHaveLength(1);
		const body = posts[0].body as Array<{ type: string; string?: string }>;
		expect(body).toEqual(expect.arrayContaining([{ type: 'location', string: 'First Location' }]));
	});

	it('empty patch → no fetch calls at all (early return, no GET)', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await updateRehearsal({ db: 'd', token: 't' }, 'event4', {});

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('sibling guard: updateRehearsal for event1 issues NO calls to event2 URL', async () => {
		const { fetchMock } = makeRehearsalFetch({ startDatetimeValueId: 'sdt-5' });
		vi.stubGlobal('fetch', fetchMock);

		await updateRehearsal({ db: 'd', token: 't' }, 'event1', {
			start_datetime: '2026-09-22T16:00:00.000Z',
		});

		const allUrls = (fetchMock.mock.calls as Array<[string, unknown]>).map(([url]) => url);
		expect(allUrls.every((u) => !u.includes('event2'))).toBe(true);
	});
});
