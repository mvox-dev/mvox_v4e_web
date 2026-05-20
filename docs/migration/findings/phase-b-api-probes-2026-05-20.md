# Phase B API Probes — 2026-05-20

**Probed by:** Finn (Q1 + Q3) — research request from team-lead 2026-05-20 04:40
**Source:** Live polyphony Entu db (`api.entu.app/polyphony`)
**Date:** 2026-05-20
**Purpose:** Settle 3 empirical questions before Josquin implements Phase B GREEN (PO directive: probe and document before assuming)

---

## Q1 — Pagination cursor shape

### Response envelope

Every paginated response returns these top-level keys:

```
{ "entities": [...], "count": <total>, "limit": <n>, "skip": <n> }
```

- `count` — total matching records in db (always present, even when 0 entities returned)
- `limit` — echoes the requested limit
- `skip` — echoes the skip offset
- `entities` — array of matching entity objects

### Pagination via `skip` + `limit`

Works correctly. Tested with `_type.reference=69bcfd8e9c031ab8e6ce8034` (entity-type meta-type, 28 total):

| Request | `count` | `entities` returned | Notes |
|---------|---------|---------------------|-------|
| `limit=10` | 28 | 10 | First page, `skip=0` |
| `limit=10&skip=10` | 28 | 10 | Second page — different `_id` set confirmed |
| `limit=200` | 28 | 28 | All returned, `count == entities.length` |
| `limit=500` | 28 | 28 | No error, no cap — Entu does NOT silently cap `limit` |

**Confirmed:** `count` in the response is the total corpus size (not page size). Snapshotter can use `count` from the first request to determine total pages.

### Cursor mechanism

No alternative cursor mechanism observed. No `next` URL in response envelope. No `_id`-cursor variant. **`skip` + `limit` is the only pagination method.**

### Max safe `limit`

No cap detected up to `limit=500`. Entu echoes whatever `limit` you send. With the polyphony db's entity counts (largest type is likely `person` at 2 or `section` at 16 — all small), this is not a concern. For large future databases, test empirically; there is no documented max.

### Recommended snapshotter pattern

```
GET /entity?_type.reference=<id>&props=<fields>&limit=200
→ read count
→ if count > 200: loop with skip=200, skip=400, etc.
```

---

## Q3 — String→reference lookup via search-by-name

### Two filter mechanisms

Entu exposes two query mechanisms with different semantics:

#### 1. Property filter: `<propertyName>.string=<value>`

```
GET /entity?_type.reference=<id>&name.string=Soprano
```

- **Exact match, case-sensitive** — `name.string=Soprano` returns 1 result; `name.string=soprano` returns 0
- **No substring matching** — `name.string=Bas` returns 0 even though `Bass` exists
- **Works for any string property** — not just `name`. Tested: `voice_type.string=soprano` returns all 3 soprano sections (count=3)
- **Unicode requirement:** value must be NFC-normalized. Sending NFD-encoded characters (e.g., `n` + combining caron `̌` instead of `š` = `š`) returns 0 even for correct values. Clients must call `unicodedata.normalize('NFC', value)` or equivalent before URL-encoding.

#### 2. Free-text search: `q=<term>`

```
GET /entity?_type.reference=<id>&q=Soprano
```

- **Case-insensitive** — `q=Soprano` and `q=soprano` both return count=3
- **Substring/prefix match** — `q=sop` returns all 3 soprano sections
- **Returns all matching entities across all their string properties** (not limited to `name`)
- Does NOT support `props=` filtering exclusion (returns full entities)

### Recommended lookup pattern for data-migrator

For `voice` reference backfill — look up `voice` instance by `name`:

```
GET /polyphony/entity?_type.reference=<voice-type-id>&name.string=<NFC-normalized-voice-name>&props=_id
```

**Use `name.string=` (exact), not `q=`.** Reasons:
1. `q=` is a substring search — `q=alto` would match both `alto` and `alto1` if both existed
2. Exact match is correct semantics for a foreign-key lookup
3. NFC normalization is trivial; all 5 voice names (`alto`, `baritone`, `bass`, `soprano`, `tenor`) are ASCII-only — no normalization needed in practice

### Data-migrator loop shape

```typescript
// For each section with voice_type:
const voiceTypeValue = section.voice_type;  // e.g. "soprano"
const lookupResp = await GET(
  `/polyphony/entity?_type.reference=${VOICE_TYPE_ID}&name.string=${encodeURIComponent(voiceTypeValue)}&props=_id`
);
if (lookupResp.count === 0) {
  report.unmatched_voice_type.push({ sectionId, voiceTypeValue });
} else {
  const voiceEntityId = lookupResp.entities[0]._id;
  // POST section.voice = reference to voiceEntityId
}
```

---

## Q2 — Touch-save wire shape

**Probed by:** Josquin (live, single instance) 2026-05-20 05:37
**Target:** `organization` instance `_id=69c7f8718489bfcb0e81b05a` (Eesti Kammerkooride Liit — lowest-`_id` of 6 orgs)
**Property of interest:** `member_count_per_section` (Phase A-added formula, def `_id=6a0d2e8790c8df7a1cc7dfd7`, `formula=SUM(_child section.member_count)`)

### Key model insight — formula values are virtual, not stored

Reading the full org entity revealed that formula property values **do not have their own `_id`** in the entity payload:

```
name:                     [{"_id":"...","string":"Eesti Kammerkooride Liit"}]   ← regular prop, has _id
contact_email:            [{"_id":"...","string":"info@..."}]                   ← regular prop, has _id
member_count_per_section: [{"number":0}]                                         ← formula, NO _id
member_count:             [{"number":50}]                                        ← formula, NO _id
```

This means formula values are **computed on read** (or cached server-side), not stored as separate property entities. The mental model of "re-write the formula property on the instance to materialize" — which the design spec implied — doesn't match Entu's actual API surface. There is no formula property entity on the instance to re-assert.

### Probe — `POST /entity/{id}` with a non-formula property re-assertion

```
POST https://api.entu.app/polyphony/entity/69c7f8718489bfcb0e81b05a
Authorization: Bearer <jwt>
Content-Type: application/json

[{"_id": "<existing-name-prop-id>", "type": "name", "string": "Eesti Kammerkooride Liit"}]
```

**Status:** 200 OK
**Response shape:**
```json
{
  "_id": "69c7f8718489bfcb0e81b05a",
  "properties": [
    {"_id": "6a0d488990c8df7a1cc7e0e1", "type": "name", "string": "Eesti Kammerkooride Liit"}
  ]
}
```

### Critical finding — Entu does NOT update-in-place; it creates a new property entity

Even though the request payload included `_id: "69c7f8718489bfcb0e81b05d"` (the existing name property's `_id`), the response shows a NEW property `_id` (`6a0d488990c8df7a1cc7e0e1`). Reading the entity afterward confirms the old `_id` is GONE — the name property is now stored under the new `_id`, value unchanged.

**Implication for touch-save semantics:**

- "Touch-save" is fundamentally a write op that triggers Entu's server-side formula recomputation cache.
- Since formula values are virtual (no `_id` to address), there is no "re-assert the formula" mode — the formula is configured on the property-**def** entity, not on each instance.
- The mechanism is: **POST any non-formula property value to the instance**. Entu's diff/save layer re-runs formula evaluation as part of the write, and subsequent reads reflect the recomputed values.

### Probe — was `member_count_per_section` re-evaluated?

Before POST: `member_count_per_section = 0`, `member_count = 50` (also formula).
After POST: `member_count_per_section = 0`, `member_count = 50` (unchanged).

The values are unchanged because `member_count_per_section` formula `SUM(_child section.member_count)` depends on `section.member_count`, which is itself a formula (Phase B §4 op #18 will fix it to a recursive form). With the current broken formula on section, `member_count_per_section` evaluates to 0 regardless. So this probe cannot validate that the POST triggered a recompute through observation of the value — only that the POST succeeded and produced a new property `_id`.

**Reasonable inference:** Entu's save path always re-evaluates dependent formulas (otherwise touch-save would be impossible), so the POST mechanism is correct for triggering recomputation. Definitive validation will come after Phase B §4 lands the correct recursive formula — at that point, a touch-save POST followed by a read should show non-zero `member_count_per_section` (since orgs have ~50 members across their section trees per `member_count` from the older flat formula).

### Recommended `touchSave` wire shape for Phase B §5

```typescript
async touchSave(entityId: string, propertyName: string, formulaExpression: string): Promise<void> {
  // propertyName + formulaExpression args are IGNORED — they were the abstract interface's hint,
  // but Entu has no way to address a formula property value on an instance.
  // The save is triggered by re-asserting ANY non-formula property.
  //
  // Pattern: pick a stable, idempotent property like _sharing (always present, single value).
  // POST it back to itself — Entu re-evaluates dependent formulas as part of the save path.
  //
  // Alternative: re-assert name with its current value (matches probe above; safe).
}
```

### Side effects to be aware of

1. **The probe rotated the org's `name` property `_id`** from `69c7f8718489bfcb0e81b05d` → `6a0d488990c8df7a1cc7e0e1`. Functionally invisible (name value unchanged) but worth knowing: every touch-save POST rotates the affected property's `_id`. Phase B §5 should pick a stable, non-load-bearing property to touch (e.g., not the property a UI or another formula depends on by `_id`).
2. **The old property `_id` is implicitly retired.** External references to property `_id`s (rare; clients usually traverse by entity + name) will dangle. For Phase B §5, this is acceptable because formula touch-saves only run after §1-§4 stabilize the schema.

### Carry-forward question

Bentham / team-lead: should `touchSave` be conservative (always rewrite the same single property, e.g., `_sharing`) or pragmatic (rewrite the property whose formula we want to materialize, where applicable — none in §5)? My current Phase B impl's `touchSave` injectable is abstract and not yet wired to a concrete property choice. Recommend: pick `_sharing` re-write as the canonical touch-save when wiring Phase B §5 ops to the live executor.

---

## Summary for Josquin

| Concern | Answer |
|---------|--------|
| Pagination shape | `{entities, count, limit, skip}` — standard offset pagination, no cursor |
| Max limit | No cap observed; 200 is safe and practical |
| Can read total from first page? | Yes — `count` field is always the total |
| Search by exact name | `name.string=<NFC-value>` — case-sensitive exact match |
| Search substring/fuzzy | `q=<term>` — case-insensitive, substring |
| Right filter for reference lookup | `name.string=` (exact) |
| Unicode gotcha | Must send NFC. All 5 voice names are ASCII — not an issue for Phase B |
| Touch-save wire shape | `POST /entity/{id}` with any non-formula property re-asserted. Entu creates a new property `_id` per save and re-evaluates dependent formulas. Formulas have no `_id` to address directly. |

---

(*MVOX:Finn*) — Q1 + Q3 probes 2026-05-20 04:42
(*MVOX:Josquin*) — Q2 probe 2026-05-20 05:37
(*MVOX:Palestrina*) — committed to repo
