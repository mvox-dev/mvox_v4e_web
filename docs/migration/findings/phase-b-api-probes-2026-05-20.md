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

## Q4 — Formula re-evaluation after source deletion (PO-requested probe 2026-05-20)

**Probed by:** Josquin (live, single non-PO instance) 2026-05-20 07:32
**Target:** anonymous person `_id=6a097dcc90c8df7a1cc7d6dd` (only non-PO person in polyphony)
**Question:** if you DELETE a source property that a formula references, does the existing materialized formula value persist on the instance, or does Entu re-evaluate to reflect the missing source?

### Probe sequence

| Step | Op | Result |
|------|----|--------|
| 0. INITIAL read | GET /entity/{id} | `forename=undefined, surname=undefined, name=[{string:" "}]` (a single space — formula `forename ' ' surname` materialized against empty sources to just the literal `' '`) |
| 1. Setup | POST `[{type:'forename', string:'Test'}, {type:'surname', string:'User'}]` | 200 OK; new prop _ids issued: `forename=6a0d613090c8df7a1cc7e0e6`, `surname=6a0d613090c8df7a1cc7e0e7` |
| 2. BEFORE | GET /entity/{id} | `forename=[{_id, string:"Test"}], surname=[{_id, string:"User"}], name=[{string:"Test User"}]` ← formula materialized as expected |
| 3. DELETE forename | DELETE /property/6a0d613090c8df7a1cc7e0e6 | 200 OK, `{deleted:true}` |
| 4. **AFTER** | GET /entity/{id} | `forename=undefined, surname=[{_id, string:"User"}], name=[{string:"Test User"}]` ← **name STILL "Test User" despite forename being gone** |
| 5. RESTORE | POST `[{type:'forename', string:'Test'}]` | 200 OK; new prop `_id=6a0d613090c8df7a1cc7e0e8` (rotated, per Q2 finding) |
| 6. FINAL | GET /entity/{id} | `forename=[{_id:6a0d613090c8df7a1cc7e0e8, string:"Test"}], surname=..., name=[{string:"Test User"}]` ← state restored |

### Conclusion: **Entu RETAINS materialized formula values after source deletion**

The materialized `name` value `"Test User"` survived the deletion of its source `forename` property. The formula expression `forename ' ' surname` did NOT re-evaluate against the now-missing source to produce `" User"` or empty.

This **contradicts the naive inference** from Q2 (formula values have no `_id` so they're "virtual reads"). Q2 was correct that materialized formula values have no per-value `_id`, BUT they are nevertheless **persisted on the instance** and not recomputed on every read. They appear to be re-evaluated only when (a) the property-def's formula expression changes, (b) the instance is explicitly written to (any non-formula property POST — see Q2 touch-save), or (c) some other materialization trigger Entu uses internally.

An additional observation: the INITIAL state (before any forename/surname was ever written) had `name=[{string:" "}]` — a single space. This is the literal output of `forename ' ' surname` evaluated against empty sources. So the materialized value was computed at some point (possibly entity creation, possibly type-def installation) and persisted thereafter — never re-evaluated by absence of sources.

### Implication for §2.8 (person.forename/surname delete)

**Bentham's Option A is safe:** deleting `forename` and `surname` from person entities will NOT break `person.name`. The current materialized value will persist. Phase B §2.8 can proceed with verify_then_delete as designed.

**However**, two carry-forward concerns:
1. **Verify materialized name values are NOT empty/whitespace** *before* deletion. The INITIAL state showed an entity with `name=" "` — pure whitespace. If any production person has whitespace-only materialized name, deletion would leave them with a useless cached value. The Phase B §2.8 verify step should require `name` to match `/\S/` (some non-whitespace content) before allowing the delete.
2. **The `name` value becomes frozen-in-time.** Future updates to forename/surname (e.g. a name correction) will only affect the materialized `name` IF the user knows to re-write one of the source props. After Phase B deletes the sources, there's no way to ever correct `name` short of writing `person.name` directly (the formula-property semantics may or may not allow that). This may be acceptable if person records are write-once for legacy data; it's not if names change. PO call.

### Side effects to be aware of (this probe)

1. **Touched 1 anonymous person** (`6a097dcc90c8df7a1cc7d6dd`): added forename=Test, surname=User. The person's end-state has forename=Test, surname=User, name="Test User" — per team-lead's "PO wants 'Test User' as the end state" directive. NOT PO's own person.
2. **Property `_id` rotation observed twice** (matching Q2): forename `_id` was `6a0d613090c8df7a1cc7e0e6` (after setup), then deleted, then restored as `6a0d613090c8df7a1cc7e0e8` (new _id).

---

## Q5 — Direct write to formula property (post-migration name correction path)

**Probed by:** Josquin (live, anonymous person continuing from Q4) 2026-05-20 07:37
**Target:** anonymous person `_id=6a097dcc90c8df7a1cc7d6dd` (end-of-Q4 state: forename=Test, surname=User, name="Test User")
**Question:** can `person.name` (a formula property) be DIRECTLY written? If yes, does the direct value persist or does the formula re-evaluate and overwrite?

### Probe sequence

| Step | Op | Result |
|------|----|--------|
| START | GET | forename=`[{Test}]`, surname=`[{User}]`, name=`"Test User"` |
| Test 1 — POST name=OverrideName | POST `[{type:'name', string:'OverrideName'}]` | **200 OK**, response shows new property `_id` for the override |
| Test 1 — GET | GET | name=`[{string:"Test User"}]` — **direct write REJECTED by formula re-evaluation** |
| Test 2 — POST forename=Changed | POST `[{type:'forename', string:'Changed'}]` | **200 OK**, response shows new forename `_id` |
| Test 2 — GET | GET | forename=`[{Test}, {Changed}]` (TWO values!), name=`"TestChanged User"` |
| Restore attempt 1: POST forename=Test | POST `[{type:'forename', string:'Test'}]` | forename=`[{Test}, {Changed}, {Test}]` (THREE values), name=`"TestChangedTest User"` |
| Restore attempt 2: POST name=Test User (direct) | POST `[{type:'name', string:'Test User'}]` | 200 OK, but GET still shows `"TestChangedTest User"` — **formula re-eval beat the direct write** |
| Cleanup: DELETE all 3 forename property `_id`s | DELETE x3 | All 200 OK |
| Cleanup GET after deletes | GET | forename=undefined, name=`"Test User"` ← Q4 finding confirmed (cached value persists after source delete) |
| Cleanup: POST forename=Test (single) | POST | 200 OK, formula re-evaluates |
| **FINAL** | GET | forename=`[{Test}]`, surname=`[{User}]`, name=`"Test User"` ✓ |

### Conclusions

1. **`person.name` is NOT directly writable** — Entu accepts the POST (200, new property `_id`) but the formula immediately re-evaluates against the current source values and overwrites the direct value. Net effect: direct writes to formula properties are silently dropped.

2. **All non-formula string properties are implicitly multi-valued** — POST `forename='Changed'` to an entity that already has `forename='Test'` **adds a second value** rather than replacing. After two POSTs the entity had `forename=[Test, Changed]` and the formula concatenated both → `name="TestChanged User"`. To set a single value, you must DELETE all existing instances first OR (per polyphony's apparent design) treat each POST as additive history rather than replacement. **This is a significant operational implication for ALL Phase B per-instance writes.**

3. **Formula concatenation across multi-value sources** — when forename had `[Test, Changed]`, the formula `forename ' ' surname` evaluated to `"TestChanged User"` (concatenation without separator between Test and Changed), then ` User`. The formula treats multi-value source as a join.

### Implication for §2.8 + post-migration name UX

**Bentham's Option A is still SAFE for §2.8 deletion** — Q4 confirmed materialized name persists after source delete. But the post-migration name correction path is **broken** for `person.name`:

- **Direct write to `person.name` is rejected by the formula** (Q5 Test 1). So once forename/surname are deleted, there's no clean way to "correct" a person's name. The only mutation that affects `name` is rewriting forename/surname — but if those are deleted at the type-def level (Phase B §2.8), no new forename/surname can ever be added to that person again.

- **Path forward depends on PO disposition for §2.8:**
  - **Option A.1 (proceed as-is):** Phase B deletes forename+surname. Person records become "name-read-only" — frozen at their current materialized value. Correctable only by manual DB intervention or future Phase D restructuring.
  - **Option A.2 (defer §2.8 to Phase D):** Skip forename+surname delete in Phase B. Keep them as the editable source-of-truth; treat `name` as a derived-by-formula view. Phase D can revisit when v4E's person model is overhauled.
  - **Option A.3 (custom name model in Phase B):** Replace the formula property with a directly-writable string property AT the type-def level (drop the formula on `person.name`). This makes `name` a regular string and the deletion of forename/surname becomes truly decoupled. Requires a v4E schema mutation PR per `architecture-decisions.md` schema-mutation gate — significant scope expansion.

My recommendation: **Option A.2** (defer §2.8). Keeping forename/surname as the editable source-of-truth aligns with how real systems handle name changes; the formula `name` stays a useful read-view. Phase B can ship 95% of its plan without §2.8 and document it as a Phase D follow-up.

### Implication for the migrator: write-then-cleanup pattern

The multi-value-on-POST behavior also impacts **§1 backfills and §2 migrations**. When `data-migrator.migrateProperty` POSTs `targetProperty='avatar'` value to an entity that already has avatar set, the existing value will NOT be replaced — a second value will be added. The current data-migrator GREEN tests assume single-value semantics. Two carry-forward options:
1. Add a "DELETE existing target values before POST" step to data-migrator
2. Document that the migrator's "idempotency skip when target matches source" check is essential — only writes when no existing value matches, avoiding the multi-value trap

The existing GREEN tests' idempotency-skip path naturally avoids the multi-value problem when target already matches source. But if the target prop has been written to BEFORE the migrator runs (any stale value), the migrator will append rather than replace. **Worth a probe to verify** — Q6 candidate, not blocking today.

### Side effects (this probe)

- **Anonymous person `6a097dcc90c8df7a1cc7d6dd`** ended with `forename=[{Test}], surname=[{User}], name="Test User"` — matches PO directive.
- During probe the person temporarily had forename=`[Test, Changed, Test]` (3-value list) and name=`"TestChangedTest User"`. All extra values cleaned up via DELETEs.
- Total writes: 4 POSTs + 3 DELETEs + 1 final POST = 8 writes (more than the 3-5 estimated, expanded due to multi-value POST cleanup requirement).
- PO's record `69bcfd8e9c031ab8e6ce8079` NOT touched.

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
(*MVOX:Josquin*) — Q4 probe 2026-05-20 07:32
(*MVOX:Josquin*) — Q5 probe 2026-05-20 07:37
(*MVOX:Palestrina*) — committed to repo
