# #88 — Runtime type-id resolution

## Problem

`entuSeasons.ts` hardcodes three polyphony-specific entity IDs in a `TYPE_IDS` const:

```ts
const TYPE_IDS = {
  season: '69c7ea528489bfcb0e81a044',
  event_series: '6a0d2e8490c8df7a1cc7deb1',
  event: '69c7ea548489bfcb0e81a0a2',
} as const;
```

These are used by `createSeason`, `createSeriesWithEvents` (which also creates `event` entities) to post `_type` as a reference on entity creation. When mvox targets a different Entu database, these IDs will be wrong and entity creation will fail silently or 400.

## Solution

Replace the hardcoded `TYPE_IDS` with a lazy-memoized `resolveTypeId(cfg, typeName)` helper that resolves type-definition entity IDs at runtime by name.

### Query shape (probe-verified 2026-06-06 against polyphony db)

```
GET /{db}/entity?_type.string=entity&name.string={typeName}&props=_id&limit=1
```

Type-definition entities in Entu have `_type.string = "entity"` (not `"definition"`). The query returns `{ entities: [{ _id: "..." }] }`. All three names (`season`, `event_series`, `event`) return exactly one result.

### Memoization

Module-level `Map<string, string>` keyed by `${cfg.db}:${typeName}`. Cache lives for the SPA page lifetime (cleared on reload). No explicit invalidation — type definitions don't change during a user session.

The `db` component in the key ensures correctness if a user switches databases (e.g. polyphony → staging) within a single page load.

### Error handling

If `entities` is empty (type name not found in the target database), throw:
```
Error: type definition not found: '{typeName}' in db '{cfg.db}'
```

This surfaces clearly in the UI's existing error handling rather than producing a cryptic Entu 400.

### What changes

**`src/lib/seasons/entuSeasons.ts`:**
- Delete `TYPE_IDS` const and its comment block (lines 27–36).
- Add `resolveTypeId(cfg: EntuCfg, typeName: string): Promise<string>` — fetches `_type.string=entity&name.string={typeName}&props=_id&limit=1`, takes `entities[0]._id`, memoizes.
- `createSeason`: replace `TYPE_IDS.season` with `await resolveTypeId(cfg, 'season')`.
- `createSeriesWithEvents`: replace `TYPE_IDS.event_series` with `await resolveTypeId(cfg, 'event_series')`, `TYPE_IDS.event` with `await resolveTypeId(cfg, 'event')`. The event-series resolve happens once before the loop; the event resolve also happens once (memoized) — no per-event fetch.

**No other files change.** Function signatures stay the same (`createSeason` and `createSeriesWithEvents` are already async). Callers are unaffected.

### Testing

**New tests for `resolveTypeId`:**
1. Cache miss → fetches, returns ID, memoizes.
2. Cache hit → no fetch, returns memoized ID.
3. Different db → separate cache entry, fetches again.
4. Type not found → throws with descriptive message.

**Existing tests for `createSeason` / `createSeriesWithEvents`:**
- Add a mock for the type-resolution fetch (returns a known ID). The create-entity mock already expects a `_type` reference — it will now receive the resolved ID instead of the hardcoded one. Assertions stay structurally identical; only the setup adds the resolution mock.

### Acceptance criteria

- `createSeason`/`createSeriesWithEvents` post `_type` as a reference resolved at runtime; no hardcoded IDs anywhere in the codebase.
- Works against any Entu database without code change.
- All existing tests pass with the resolution mock in place.
- `resolveTypeId` has its own unit tests (cache behavior + error case).

(*MVOX:Palestrina*)
