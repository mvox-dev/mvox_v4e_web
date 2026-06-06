# #88 Runtime Type-ID Resolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded polyphony-specific `TYPE_IDS` const in `entuSeasons.ts` with a lazy-memoized `resolveTypeId()` that resolves entity-type IDs at runtime by name, so entity creation works against any Entu database.

**Architecture:** A single exported `resolveTypeId(cfg, typeName)` function queries `GET /{db}/entity?_type.string=entity&name.string={typeName}&props=_id&limit=1`, takes `entities[0]._id`, and memoizes in a module-level `Map` keyed by `${db}:${typeName}`. The three callsites in `createSeason` and `createSeriesWithEvents` replace `TYPE_IDS.x` with `await resolveTypeId(cfg, 'x')`.

**Tech Stack:** TypeScript, Vitest, global `fetch` mock pattern (existing).

**Branch:** `feat/runtime-type-ids` off clean main.

**TDD chain:** Tallis (RED) → Josquin (GREEN) → Bentham (REVIEW) → Josquin (MERGE). No i18n (no user-facing strings). No Byrd (no UI changes).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/seasons/entuSeasons.ts` | Modify | Add `resolveTypeId`, delete `TYPE_IDS`, update 3 callsites |
| `src/lib/seasons/entuSeasons.spec.ts` | Modify | Add `resolveTypeId` tests, update create-function mocks |

No new files. No other files touched.

---

### Task 1: RED — `resolveTypeId` unit tests

**Owner:** Tallis
**Files:**
- Modify: `src/lib/seasons/entuSeasons.spec.ts`

- [ ] **Step 1: Add the `resolveTypeId` import to the test file**

Add `resolveTypeId` and `resetTypeIdCache` to the import block at the top of `entuSeasons.spec.ts`:

```ts
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
```

- [ ] **Step 2: Write the `resolveTypeId` test suite**

Add a new `describe('resolveTypeId')` block right after the `beforeEach` (line 20) and before the `createSeason` describe block (line 24). Place it here so the helper tests run first:

```ts
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
```

- [ ] **Step 3: Run the tests to confirm RED**

Run: `pnpm vitest run src/lib/seasons/entuSeasons.spec.ts 2>&1 | tail -30`

Expected: compilation failure — `resolveTypeId` and `resetTypeIdCache` do not exist yet. All 4 new tests fail. Existing tests still pass (they don't depend on the new exports).

- [ ] **Step 4: Commit RED**

```bash
git add src/lib/seasons/entuSeasons.spec.ts
git commit -m "test(#88): RED — resolveTypeId unit tests (cache miss, hit, cross-db, not-found)"
```

---

### Task 2: GREEN — implement `resolveTypeId` + wire into create functions

**Owner:** Josquin
**Files:**
- Modify: `src/lib/seasons/entuSeasons.ts`
- Modify: `src/lib/seasons/entuSeasons.spec.ts` (update existing create-function mocks)

- [ ] **Step 1: Add `resolveTypeId` and `resetTypeIdCache` to `entuSeasons.ts`**

Delete the `TYPE_IDS` const and its comment block (lines 27–36). In its place, add:

```ts
const typeIdCache = new Map<string, string>();

export async function resolveTypeId(cfg: EntuCfg, typeName: string): Promise<string> {
	const key = `${cfg.db}:${typeName}`;
	const cached = typeIdCache.get(key);
	if (cached) return cached;

	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=entity&name.string=${typeName}&props=_id&limit=1`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) {
		throw new Error(`resolveTypeId failed: ${res.status}`);
	}
	const body = (await res.json()) as { entities?: Array<{ _id: string }> };
	const id = body.entities?.[0]?._id;
	if (!id) {
		throw new Error(`type definition not found: '${typeName}' in db '${cfg.db}'`);
	}
	typeIdCache.set(key, id);
	return id;
}

export function resetTypeIdCache(): void {
	typeIdCache.clear();
}
```

- [ ] **Step 2: Update `createSeason` to use `resolveTypeId`**

Replace the current `createSeason` function body:

```ts
export async function createSeason(cfg: EntuCfg, input: CreateSeasonInput): Promise<string> {
	const seasonTypeId = await resolveTypeId(cfg, 'season');
	return createEntity(cfg, [
		{ type: '_type', reference: seasonTypeId },
		{ type: '_parent', reference: input.orgId },
		{ type: '_sharing', string: 'public' },
		{ type: 'name', string: input.name },
		{ type: 'start_date', date: input.startDate },
		{ type: 'end_date', date: input.endDate },
	]);
}
```

- [ ] **Step 3: Update `createSeriesWithEvents` to use `resolveTypeId`**

At the top of `createSeriesWithEvents`, before building `seriesProps`, add:

```ts
const eventSeriesTypeId = await resolveTypeId(cfg, 'event_series');
const eventTypeId = await resolveTypeId(cfg, 'event');
```

Then replace the two hardcoded references:
- `{ type: '_type', reference: TYPE_IDS.event_series }` → `{ type: '_type', reference: eventSeriesTypeId }`
- `{ type: '_type', reference: TYPE_IDS.event }` → `{ type: '_type', reference: eventTypeId }`

The `event` resolve is hoisted before the loop so the memoized value is used for every event iteration (no per-event fetch).

- [ ] **Step 4: Update existing `createSeason` test mocks**

The `createSeason` tests currently stub `fetch` with a single mock that handles the entity-create POST. Now `createSeason` makes TWO fetches: first `resolveTypeId` (GET), then `createEntity` (POST). Update the three `createSeason` tests.

For the first test (`'POSTs the entity with public sharing and returns _id'`), replace the fetch mock:

```ts
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
		(c: [string, ...unknown[]]) => !c[0].includes('_type.string=entity'),
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
```

For the URL test (`'POSTs to the correct Entu entity-create URL'`):

```ts
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
		(c: [string, ...unknown[]]) => !c[0].includes('_type.string=entity'),
	)!;
	const url: string = createCall[0] as string;
	expect(url).toContain('testdb');
	expect(url).toContain('entity');
});
```

For the error test (`'throws when Entu returns ok: false'`):

```ts
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
```

- [ ] **Step 5: Update existing `createSeriesWithEvents` test mocks**

The `createSeriesWithEvents` tests use a `fetch` mock that intercepts ALL calls (series create + N event creates). Now `resolveTypeId` fires two GET calls first (event_series + event types, both cache-miss on first call within the test). The simplest fix: add `resetTypeIdCache()` in each test and make the fetch mock route type-resolution GETs vs create POSTs.

For the first test (`'generates one event per occurrence with DST-correct datetimes'`):

```ts
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
```

Apply the same routing pattern to every other `createSeriesWithEvents` test: add `resetTypeIdCache()` at the top, and make the fetch mock branch on `url.includes('_type.string=entity')` → return `{ entities: [{ _id: 'resolved-<typeName>' }] }` before falling through to the existing create-entity mock logic.

The remaining tests in the `createSeriesWithEvents` describe block are:
- `'returns seriesId from the first POST response'`
- `'emits location on series when provided'`
- `'throws PartialGenerationError on mid-generation failure'`

Each needs the same fetch-routing wrapper. The existing assertions remain structurally identical — they test create-POST behavior, which is unchanged.

- [ ] **Step 6: Run ALL tests**

Run: `pnpm vitest run src/lib/seasons/entuSeasons.spec.ts 2>&1 | tail -30`

Expected: ALL tests pass — the 4 new `resolveTypeId` tests + all existing tests with updated mocks.

- [ ] **Step 7: Run `pnpm check`**

Run: `pnpm check`

Expected: 0 type errors.

- [ ] **Step 8: Verify no hardcoded TYPE_IDS remain**

Run: `grep -rn 'TYPE_IDS\|69c7ea528489bfcb0e81a044\|6a0d2e8490c8df7a1cc7deb1\|69c7ea548489bfcb0e81a0a2' src/`

Expected: zero matches. The hardcoded IDs should ONLY appear in the test file's `resolved-` mock values (which are arbitrary test strings, not real IDs). If any real polyphony IDs remain, something was missed.

- [ ] **Step 9: Commit GREEN**

```bash
git add src/lib/seasons/entuSeasons.ts src/lib/seasons/entuSeasons.spec.ts
git commit -m "feat(#88): runtime type-id resolution — resolveTypeId + wired into create functions

Replaces hardcoded polyphony TYPE_IDS with lazy-memoized
resolveTypeId(cfg, typeName) that queries Entu by name.
Works against any Entu db without code change.

Closes #88"
```

---

### Task 3: REVIEW — Bentham code review

**Owner:** Bentham
**Files:** read-only review of changes from Tasks 1–2

- [ ] **Step 1: Review the diff**

Run: `git diff main..HEAD -- src/lib/seasons/entuSeasons.ts src/lib/seasons/entuSeasons.spec.ts`

Review checklist:
- `resolveTypeId` queries `_type.string=entity` (not `definition`) — probe-verified
- Cache key includes `cfg.db` — cross-db correctness
- Error message includes both `typeName` and `cfg.db` — debuggable
- No hardcoded polyphony IDs remain in source (only in test mock return values as arbitrary strings)
- `resetTypeIdCache` is exported for test isolation only — acceptable
- `createSeriesWithEvents` hoists both `resolveTypeId` calls before the event loop — no per-event fetch
- All existing test assertions are structurally preserved (mock routing is the only change)
- No security issues (no auth changes, no new endpoints, same fetch pattern)

- [ ] **Step 2: Issue verdict**

RED / YELLOW / GREEN with rationale. Report to team-lead.

---

### Task 4: MERGE — squash-merge to main

**Owner:** Josquin
**Precondition:** Bentham GREEN (or YELLOW with all notes addressed)

- [ ] **Step 1: Squash-merge**

```bash
git checkout main
git pull
git merge --squash feat/runtime-type-ids
git commit -m "feat(#88): runtime type-id resolution — resolveTypeId replaces hardcoded polyphony TYPE_IDS

Lazy-memoized resolveTypeId(cfg, typeName) queries Entu type-def
entities by name at runtime. Cached per db:typeName for SPA lifetime.
Works against any Entu db without code change.

Closes #88"
```

- [ ] **Step 2: Verify on main**

Run: `pnpm vitest run src/lib/seasons/entuSeasons.spec.ts && pnpm check`

Expected: all tests pass, 0 type errors.

- [ ] **Step 3: Push + cleanup**

```bash
git push
git branch -d feat/runtime-type-ids
git push origin --delete feat/runtime-type-ids
```

- [ ] **Step 4: Deploy to preview**

```bash
pnpm build
set -a; . ~/.config/mvox/credentials.env; set +a
wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox --branch=preview-seasons
```

---

(*MVOX:Palestrina*)
