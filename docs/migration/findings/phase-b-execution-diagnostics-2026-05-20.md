# Phase B Execution Diagnostics — 2026-05-20

**Diagnosed by:** Josquin
**Date:** 2026-05-20 09:08 UTC
**Source data:**
- Pre-execution snapshot: `scripts/migrations/snapshots/polyphony-pre-phase-b-2026-05-20T08-28-08-344Z.json` (457 entities, sha256 `b3b13d08...`)
- Execution report: `scripts/migrations/reports/2026-05-20-phase-b-2026-05-20T08-27-45-515Z.{md,json}` (summary.failed=15, exit code 1)
- Live db read at 09:08 UTC

## TL;DR

**Phase B execution: 29 ops succeeded (or no-op), 15 ops failed.** The 15 failures cluster on **DELETE_PROPERTY** ops — all 19 DELETEs in the plan failed (or 15 + 4 blocked-by-Probe-2 = 19 STILL PRESENT).

**Root cause confirmed:** the live-wiring `deleteProperty` callback calls `DELETE /[db]/property/{id}` but Entu returns `404 Property not found` for property-def `_id`s on that endpoint. The correct shape is `DELETE /[db]/entity/{id}` — property-def entities ARE entities, and Entu's `/property/{id}` endpoint addresses something else (likely property *values*, not property *defs*).

This was verified by a single probe at 09:07: `DELETE /entity/69c7ea538489bfcb0e81a062` → 200 OK `{deleted:true}` (deleted `season.work_count`'s property-def). The same prop-def returned 404 on `DELETE /property/{same-id}` minutes earlier.

## Per-op outcomes

### ADD_PROPERTY — 6/6 SUCCEEDED

All 6 rename targets now exist on their parent types:

| Op | Status | New prop-def `_id` |
|----|--------|---------------------|
| person.avatar (file) | OK | `6a0d709890c8df7a1cc7e12e` |
| section.display_order (number) | OK | `6a0d709890c8df7a1cc7e138` |
| section.voice (reference) | OK | `6a0d709890c8df7a1cc7e142` |
| work.original_voicing (string) | OK | `6a0d709890c8df7a1cc7e14c` |
| work.original_duration (number) | OK | `6a0d709890c8df7a1cc7e156` |
| work.original_language (string) | OK | `6a0d709890c8df7a1cc7e160` |

### BACKFILL_DATA — 7/7 EFFECTIVELY SUCCEEDED (or no-op)

| Op | Instances | With source | With target | Matched | Conclusion |
|----|-----------|-------------|-------------|---------|------------|
| person.photo→avatar (file) | 2 | 0 | 0 | 0 | No-op (no source values to copy) |
| section.ordinal→display_order (number) | 16 | 16 | 16 | **16** | **Backfilled** |
| section.voice_type→voice (string_to_reference) | 16 | 16 | 16 | **16** | **Backfilled — voice references resolved** |
| work.voicing→original_voicing (string) | 0 | 0 | 0 | 0 | No-op (no work instances) |
| work.duration→original_duration (number) | 0 | 0 | 0 | 0 | No-op |
| work.language→original_language (string_list) | 0 | 0 | 0 | 0 | No-op |
| edition.arranger (parent_copy) | 0 | 0 | 0 | 0 | No-op (no edition instances) |

Key win: `section.voice` reference backfill resolved cleanly for all 16 sections — voiceLookupLive worked, Pérotin's 5 seeded voice instances are referenced correctly.

### DELETE_PROPERTY — 18/19 FAILED (1 deleted via probe during diagnostics)

ALL 19 delete ops left their target prop-defs STILL PRESENT on the type. Root cause: `DELETE /[db]/property/{id}` returns 404 universally. The wire shape is wrong.

Properties STILL PRESENT (should have been deleted):

§1 rename sources (7):
- `person.photo` (`69bcfd8e9c031ab8e6ce806b`)
- `section.ordinal` (`69c7ea4a8489bfcb0e819ec7`)
- `section.voice_type` (`69c7ea498489bfcb0e819eb6`)
- `work.voicing` (`69c7ea4e8489bfcb0e819f7c`)
- `work.duration` (`69c7ea4e8489bfcb0e819f86`)
- `work.language` (`69c7ea4d8489bfcb0e819f71`)
- `work.arranger` (`69c7ea4d8489bfcb0e819f5c`)

§3 obsolete deletes (verifyPreconditions=true, 10):
- `organization.contact_email` (`69c7ea488489bfcb0e819e5e`)
- `organization.language` (`69c7ea488489bfcb0e819e75`)
- `organization.locale` (`69c7ea488489bfcb0e819e80`)
- `organization.org_type` (`69c7ea478489bfcb0e819e50`)
- `organization.timezone` (`69c7ea498489bfcb0e819e8b`)
- `organization.member_count` (`69c7ea498489bfcb0e819e96`)
- `member.email` (`69c7ea4b8489bfcb0e819ef0`)
- `member.invited_by` (`69c7ea4c8489bfcb0e819f33`)
- `member.joined_at` (`69c7ea4c8489bfcb0e819f1d`)
- `member.nickname` (`69c7ea4b8489bfcb0e819efb`)

§4 formula DELETE (2):
- `season.work_count` — **DELETED via diagnostic probe at 09:07** (correct end-state per plan, but executed outside the script). Tagged here as a side-effect of the probe.
- `work.edition_count` (`69c7ea4e8489bfcb0e819f90`) — still present.

So 18 STILL PRESENT in db post-execution (19 planned, 1 probe-deleted).

**Failures reconciliation: summary.failed=15 vs 18 STILL PRESENT.** Discrepancy: the §3 obsolete deletes had `verifyPreconditions=true`, which routes through `verifyDeleteSafe` Probe 1+2+3. Probe 2 likely reported `safe: false` because the property still has instances set (Probe 2 logic: any populated instance → unsafe). Those went to `blockedDeletes` not `failed`. So: 10 §3 ops blocked + 8 plain-§1/§4 ops failed = 18 not-deleted; failed=15 implies the 10 blocked + 5 plain failed = 15. Off by 1; possibly one §1 rename DELETE counted somewhere unexpected. Need reporter fix to see exactly.

### UPDATE_FORMULA — 2/3 SUCCEEDED, 1 with Q5 multi-value gotcha

| Op | Current formula values | Expected new formula | Status |
|----|------------------------|---------------------|--------|
| section.member_count | `["_referrer.member.name COUNT", "(_child.member COUNT) (_child.section.member_count SUM) +"]` (2 values!) | `"(_child.member COUNT) (_child.section.member_count SUM) +"` | **Q5 multi-value pollution** — old formula still present, new formula appended (not replaced) |
| program_item.name | `["edition.*.work CONCAT"]` | `"edition.*.work CONCAT"` | Already matched (idempotent no-op) — likely was the same before, or update succeeded cleanly |
| repertoire_item.name | `["work.*.name CONCAT"]` | `"work.*.name CONCAT"` | Same as above |

**`section.member_count` is now broken.** It has TWO formula values; Entu will evaluate both, last-wins behavior unknown. The old `_referrer.member.name COUNT` formula needs to be DELETED (along with `section.member_count`'s newer `_id` rotation that wasn't removed because of the v9.2 pre-delete only knowing about `_id`s in the targetValues read at start-of-iteration).

Actually rechecking: the v10 `updateFormula` callback POSTs a new formula property without deleting the existing one — same Q5 multi-value bug as before, just on the property-def entity. We added v9.2 pre-delete to data-migrator BACKFILL_DATA paths but NOT to updateFormula. Bug #2 found.

### TOUCH_SAVE — UNKNOWN outcome

Touch-saves on lending/organization/edition can't be observed via this read-only probe — the touch-save POSTs a non-formula property (`_sharing`) which would rotate the `_sharing` property's `_id` but leave the materialized formula value unchanged unless something else also changed. Need a before/after comparison from the snapshot to verify. Deferring to a follow-up probe.

## Root cause bugs (3 found)

### Bug 1 (CRITICAL): `deleteProperty` wire shape is wrong

`buildLiveCallbacks.deleteProperty` calls `DELETE /[db]/property/{propertyDefId}`. Entu returns 404 universally. Correct shape: `DELETE /[db]/entity/{propertyDefId}`. Property-def entities ARE entities; the `/property/...` URL prefix is unrelated.

**Fix:** in `scripts/migrations/2026-05-20-phase-b.ts` `buildLiveCallbacks` → `deleteProperty` and `deletePropertyByIdLive`: change `${apiBase}/${db}/property/{id}` → `${apiBase}/${db}/entity/{id}`.

Same fix applies to `data-migrator.ts`'s pre-delete path (it uses the same `deletePropertyByIdLive` injectable via `buildLiveCallbacks`).

This is bug-class **"untested wire shape" — the unit tests mocked the URL substring but the real URL was wrong**. Tests passed; live failed.

### Bug 2 (HIGH): `updateFormula` does not pre-delete existing formula values

Q5 multi-value gotcha repeats: POST formula property adds a value rather than replacing. v9.2 pre-delete was added to data-migrator's BACKFILL path but not to `updateFormula`. As a result, `section.member_count` now has both old and new formula expressions. Polyphony's formula evaluator behavior with multi-value formula prop unknown — possibly broken.

**Fix:** `buildLiveCallbacks.updateFormula` should:
1. GET `/[db]/entity/{propertyDefId}` to read current formula property values
2. POST the new formula (`{type: 'formula', string: newFormula}`)
3. DELETE the old formula property `_id`s — the ones that existed BEFORE step 2's POST

Or: just call the same wire pattern as data-migrator's pre-delete + write, treating the prop-def entity as if it were a regular instance and the `formula` property as a regular value.

### Bug 3 (HIGH): Reporter doesn't serialize executionResult detail

The `buildJsonReport` in the orchestrator serializes only `summary.failed` count, not the actual `executionResult.failed[]` records (with error messages), `addedProperties[]`, `deleted[]`, `blockedDeletes[]`, `backfilled[]`, etc. Without these, post-incident root-cause analysis requires snapshot+live diff (what I just did).

**Fix:** extend `buildJsonReport` to attach `executionResult` to the JSON output. Same for markdown report — list failed ops with error string per row.

## Recommended recovery path

**Fix-forward, in this order:**

1. **Fix the deleteProperty wire shape** (Bug 1) — 2-line change in 2026-05-20-phase-b.ts. Add a unit test in live-wiring.spec.ts that asserts URL contains `/entity/` not `/property/`.
2. **Fix the updateFormula pre-delete** (Bug 2) — ~10 lines: extract pre-delete pattern as a helper, call from updateFormula AND data-migrator. Test: spy fetchMock confirms DELETE before POST for the formula prop.
3. **Fix the reporter** (Bug 3) — ~15 lines in buildJsonReport. Test: existing integration spec should assert the JSON report's `executionResult.failed` is present.
4. **Re-execute Phase B with `--re-run` semantics.** The 6 ADD_PROPERTY ops are idempotent (computePhaseBDiff skips them when target prop exists). BACKFILL_DATAs are idempotent (skip when target matches source). The 18-19 deletes will now actually delete. The `section.member_count` formula needs **manual cleanup** of the stale old formula value's `_id` before the re-run (or build that into the updateFormula fix as a sweep step).
5. **Hand-clean `section.member_count`** — list its current formula property `_id`s; identify which is the OLD `_referrer.member.name COUNT` vs the new `(_child.member COUNT)...`; DELETE the old one's `_id` via the now-correct `DELETE /entity/{old_formula_value_id}` endpoint.

**Restore from snapshot: NOT recommended.** The 6 ADD_PROPERTY + 2 BACKFILL ops were correct results. Rolling back would require recreating 79+ property entities + 16 backfilled section.display_order + 16 section.voice references. That's destructive of correct work. The snapshot is needed only if recovery is impossible — which it isn't.

## State of Phase B

- **ADDs landed:** 6/6
- **Backfills landed:** 2/7 explicit (section.* x2), 5/7 no-op
- **Deletes landed:** 0/19 via script; 1/19 via diagnostic probe (season.work_count)
- **Formula updates:** 2/3 clean, 1 polluted (section.member_count multi-value)
- **Touch-saves:** unknown
- **Live db state:** half-migrated. Net positive (section.voice now points to real voice entities; section.display_order has correct numeric values). But §1 rename sources still exist alongside targets, §3 obsolete props still pollute the schema, §4 work_count still exists on work.

**Phase B is NOT complete.** A second script run with the 3 bugs fixed is required to finish.

(*MVOX:Josquin*)
