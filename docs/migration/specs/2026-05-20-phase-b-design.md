# Phase B — Property Renames + Data Backfill + Formula Touch-Saves

**Status:** draft (PO decisions locked 2026-05-20 04:0X; awaiting Bentham review of design)
**Authors:** team-lead (Palestrina), PO
**Related:**
- [`docs/migration/specs/2026-05-19-phase-a-design.md`](2026-05-19-phase-a-design.md) — template + executed precedent
- [`docs/migration/v4e-divergence-2026-05-19.md`](../v4e-divergence-2026-05-19.md) §4.3 — deferred-from-Phase-A op list
- [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md) — handbook
- `teams/mvox-dev/memory/team-lead.md` — session 7 seed
- `teams/mvox-dev/memory/architecture-decisions.md`

## Context

Phase A executed live 2026-05-20 03:46 UTC (HEAD `a127729`). The polyphony Entu db now has 9 new entity types and 79 new property definitions, additive only — zero data touched. The shape of the db matches v4E for all *additive* concerns.

**Phase B is the first phase that mutates live data.** Property renames, data backfills, obsolete-property deletions, and formula re-materializations on existing entities. Carries data-loss risk if the script bugs out; carries formula-staleness risk if touch-saves are skipped.

Recovery posture (PO decision): **full Entu db export immediately before execution**, committed to repo as a JSON snapshot. Phase B is otherwise fix-forward — additive-then-delete ordering means recovery from a half-executed run is "re-run; idempotency skips done-ops, completes pending-ops."

## Goals

1. Bring the polyphony Entu db's per-instance data to match v4E's renamed-property shape — backfill each renamed property's data into its new home, then delete the old property definition.
2. Delete obsolete property definitions on existing types (5 on `organization`, 4 on `member`, ~12 on `person`, 1 on `work`, ~7 historical others) — see §1 below.
3. Update formula definitions to v4E forms (4 formula updates: `section.member_count` recursive form, `program_item.name`, `repertoire_item.name`, plus retain/edit others as listed).
4. Touch-save the 3 formula properties Phase A deferred so they materialize on existing instances: `lending.name`, `organization.member_count_per_section`, `edition.work`.
5. Run autonomously with PO observing the log; produce a structured pre/post-execution report.
6. Be idempotent — safe and cheap to re-run; partial-failure recovery auto-detects done-ops.
7. Reuse Phase A library modules; add only the modules Phase B genuinely needs.

## Non-goals

- Structural restructurings (Phase C): `inventory_copy` → `copy`+`lending` data migration, `participation` → `rsvp`+`attendance` split, `role` and `affiliation` retirement.
- Rights / sharing flips (Phase D): `organization._inheritrights: false` on type + 6 instances, `_sharing` per-type alignment, `_DEPRECATED_*` cleanup.
- Schema-Change trailers on commits: v4E definition unchanged; the script consumes the schema and applies it. Same logic as Phase A.
- BFF code consuming new entity types: separate stories (CHORE-5 onward).
- Interactive supervision: no per-step prompts. PO observes the log; report is the artifact.

## Phase B operations — full list

### §1. Property renames (each = create-new + backfill + delete-old)

Per the **Rename atomicity default** (§Open items #1): each rename is modeled as **three DAG nodes** — `ADD_PROPERTY(new)` (idempotent — Phase A already added many of these via §4.2 additions), `BACKFILL_DATA(source→target)`, `DELETE_PROPERTY(source)`. The three nodes for one rename are sequenced: add → backfill → verify → delete. Failure at any node halts that rename's chain but does not abort the script — other renames continue.

| # | Source property | Target property | Backfill semantics | Notes |
|---|---|---|---|---|
| 1 | `person.photo` (file) | `person.avatar` (file) | Copy file reference for each `person` with `photo` set | Phase A did NOT add `person.avatar` (it wasn't in §4.2 list — see verification step at top of script) — Phase B may need to add first |
| 2 | `section.ordinal` (number) | `section.display_order` (number) | Copy number value for each `section` with `ordinal` set | New prop not added in Phase A — add as part of B |
| 3 | `section.voice_type` (string) | `section.voice` (reference→voice) | Look up `voice` entity by `name == voice_type value`; write reference. Sections with `voice_type` values not matching any `voice` entity are reported as `unmatched_voice_type` failures (do NOT silently drop). | Requires `voice` entity instances; Phase B includes a sub-step to **create the 6 `voice` instances** (SATB + alto1/alto2 or per polyphony's actual usage — Finn to confirm count by querying live `section.voice_type` distinct values during dry-run) |
| 4 | `work.voicing` (string) | `work.original_voicing` (string) | Copy string | New prop add as part of B |
| 5 | `work.duration` (number) | `work.original_duration` (number) | Copy number | New prop add as part of B |
| 6 | `work.language` (string list) | `work.original_language` (string list) | Copy list | New prop add as part of B; preserve `list: true` |

### §2. Property migrations into a different parent type

| # | Source | Target | Backfill semantics |
|---|---|---|---|
| 7 | `work.arranger` (string) | `edition.arranger` (string) | For each `edition`, look up parent `work`, copy `work.arranger` to `edition.arranger`. (Phase A added `edition.arranger`.) Then delete `work.arranger`. |
| 8 | `person.forename` + `person.surname` | (kept as formula `person.name`) | The `person.name` formula `forename ' ' surname` already exists and materializes. Phase B verifies materialized values are non-empty, THEN deletes `forename` + `surname`. Sequence: verify → delete. |

### §3. Obsolete property deletions (no backfill — confirmed superseded)

| # | Type | Property | Reason |
|---|---|---|---|
| 9 | `organization` | `contact_email` | v4E uses `person.preferred_contact_email` (Phase A added) |
| 10 | `organization` | `language` | Not in v4E |
| 11 | `organization` | `locale` | Not in v4E |
| 12 | `organization` | `org_type` | Not in v4E |
| 13 | `organization` | `timezone` | Not in v4E |
| 14 | `member` | `email` | Deferred to `person.preferred_contact_email` |
| 15 | `member` | `invited_by` | Invitation lifecycle (Phase A added `invitation` type) handles this |
| 16 | `member` | `joined_at` | Not in v4E |
| 17 | `member` | `nickname` | Not in v4E |

Before each delete, the script verifies the property is **unreferenced** by any formula (`schema.json` scan) and **has no remaining instances** with that property set (db query). Either condition non-empty → record as `blocked_delete` with reason; do not delete; continue.

### §4. Formula property updates

| # | Type | Property | Action |
|---|---|---|---|
| 18 | `section` | `member_count` | Update formula expression from current `_referrer.member.name COUNT` to v4E's recursive form `(_child.member COUNT) (_child.section.member_count SUM) +`. Property definition exists; only the `formula` field changes. |
| 19 | `program_item` | `name` | Add/replace formula `edition.*.work CONCAT` (depends on `edition.work` formula added in Phase A — confirmed in `phase-a-2026-05-20T03-46-18-833Z.json`). |
| 20 | `repertoire_item` | `name` | Add/replace formula `work.*.name CONCAT`. |
| 21 | `season` | `work_count` | **Delete** the property (not in v4E). Single-op delete — listed here because it's a formula prop. |

### §5. Touch-saves to materialize formulas on existing instances

| # | Target | Why | Method |
|---|---|---|---|
| 22 | All `lending` instances | Materialize `lending.name` formula (Phase A added) | At time of write, 0 lending instances exist — touch-save is a no-op until lendings are created by app code. Record as `touch_save_no_instances`. |
| 23 | All 6 `organization` instances | Materialize `organization.member_count_per_section` formula (Phase A added) — *depends on §4 op #18 completing first* | Re-write the formula property: set `formula` value to the v4E expression, even though it already matches. Forces Entu re-eval. |
| 24 | All `edition` instances | Materialize `edition.work` formula (Phase A added) | Re-write the `work` property formula value. |

Touch-saves run **after** all renames + backfills + deletes + formula-updates complete and verify clean. Order: §1 → §2 → §3 → §4 → §5.

### Summary of Phase B operations

- §1 renames: **6** (each ≈3 ops: add + backfill + delete = ~18 sub-ops)
- §2 migrations: **2** (≈3 ops each = 6 sub-ops)
- §3 obsolete deletes: **9** (1 op each = 9 sub-ops)
- §4 formula updates: **4** (1 op each = 4 sub-ops)
- §5 touch-saves: **3** (variable per-instance — 0 + 6 + N editions = ~6–50 sub-ops)

**Total estimated API operations:** ~43–87 writes, ~100–200 reads (for diffs + verifications). Well within "human can observe in one session" range; nowhere near the 104k-property bulk-delete worst case.

## Design

### Locations

| Artifact | Path |
|---|---|
| Spec (this doc) | `docs/migration/specs/2026-05-20-phase-b-design.md` |
| Implementation plan | `docs/migration/specs/2026-05-20-phase-b-plan.md` (written by writing-plans skill in a later session) |
| Migration script | `scripts/migrations/2026-05-20-phase-b.ts` |
| Tests | `scripts/migrations/2026-05-20-phase-b.spec.ts` (vitest, colocated) |
| Dry-run reports | `scripts/migrations/reports/2026-05-20-phase-b-dry-run-<ISO-timestamp>.{json,md}` |
| Execution report | `scripts/migrations/reports/2026-05-20-phase-b-<ISO-timestamp>.{json,md}` |
| **Pre-execution snapshot** | `scripts/migrations/snapshots/polyphony-pre-phase-b-<ISO-timestamp>.json` — full db export, committed |

All paths relative to `mvox-dev/mvox_v4e_web`.

### Execution environment

Identical to Phase A — runtime `tsx`, env vars `ENTU_API_BASE`, `ENTU_DB`, `ENTU_API_KEY`, `V4E_SCHEMA_PATH`. New env var: `SNAPSHOT_DIR` (default `scripts/migrations/snapshots/`).

### Algorithm

```
PHASE B EXECUTION

1. STARTUP:
   - Load v4E schema
   - Load Phase A execution report (read-only, for sanity-checking ids of newly-created types)
   - Fetch current db state (types + props + formulas)

2. PRE-EXECUTION SNAPSHOT (NEW — Phase B only):
   - Enumerate all entities in the db (paginate via /entity endpoint)
   - For each entity: fetch full payload (all props + values + system fields)
   - Serialize to single JSON file: scripts/migrations/snapshots/polyphony-pre-phase-b-<ts>.json
   - Compute sha256, log to console + report
   - In --dry-run mode: skip the actual write but log "would snapshot N entities"
   - On --skip-snapshot flag: skip entirely; report flags warning

3. COMPUTE PHASE B DIFF (extends Phase A diff):
   - For each §1 rename: compute (add_new, backfill, delete_old) sub-ops
   - For each §2 migration: compute (verify_target_exists, backfill, delete_source) sub-ops
   - For each §3 obsolete delete: compute (verify_unreferenced, delete) sub-ops
   - For each §4 formula update: compute (update_formula) sub-op
   - For each §5 touch-save: compute (rewrite_formula_prop) per-instance sub-ops
   - Order: §1 → §2 → §3 → §4 → §5 (sequential by phase; within phase, ordered for dependency safety)

4. DRY-RUN MODE (if --dry-run):
   - Print the full operation plan
   - Skip execution; emit dry-run report
   - Exit 0

5. EXECUTE (live mode):
   - For each sub-op in order:
     - Try
     - On success: record in `executed[]` with new id / timestamp
     - On failure: capture HTTP status + body + the request payload to `failed[]`; do NOT abort the script — continue to next sub-op (matches Phase A pattern; unblocks recovery via re-run)
   - Special case: §1 backfills that fail due to missing target prop → record as `blocked_by_predecessor` (the §1.add sub-op failed earlier in this run)

6. EMIT REPORT:
   - JSON + markdown to `scripts/migrations/reports/`
   - Include: summary counts, executed sub-ops, skipped (already-done) sub-ops, failed sub-ops, snapshot path + sha256

EXIT: 0 if zero failed; 1 otherwise.
```

### Idempotency

Each sub-op is independently re-runnable:

- **ADD_PROPERTY** (§1, §2 target props): query by parent-type + name; if exists, skip and record as `skipped: already_added`.
- **BACKFILL_DATA**: for each instance with source property set, query target property; if target already populated with the source value, skip; if target absent or mismatching, write. Auto-recover from partial backfills.
- **DELETE_PROPERTY**: query property by parent-type + name; if absent, skip and record as `skipped: already_deleted`. Verifies pre-conditions (unreferenced + zero instances) again at delete time.
- **UPDATE_FORMULA**: query property's current formula expression; if matches target, skip and record as `skipped: formula_current`.
- **REWRITE_FORMULA_PROP** (touch-save): always re-writes (the whole point is to trigger Entu re-eval); does not record as skipped. Records `touch_save_count: N` in the report.

### Partial-failure recovery

Apply Phase A pattern (PR #27 — `PHASE_A_NEW_TYPES + bypassScope`): if a §1 sub-op (e.g., `person.avatar` ADD_PROPERTY) was succeeded on a prior run but later sub-ops failed, the re-run must:

1. Detect the already-added prop via idempotency check (above)
2. Skip the ADD sub-op, proceed to BACKFILL
3. Backfill skips instances already-backfilled (target matches source), processes the rest
4. Delete proceeds only after backfill verifies clean

Test scenario: introduce a fake failure mid-§1 (e.g., backfill of `section.voice_type` halts after 3 of 6 sections); re-run completes the remaining 3 without re-creating already-added prop or re-writing already-backfilled values. Mirrors Phase A's `bypassScope` semantics but generalized — `phase-b-scope.ts` lists each sub-op type, and the executor's idempotency layer skips already-done.

### New modules (additions to `scripts/migrations/lib/`)

| Module | Purpose | Tests |
|---|---|---|
| `snapshotter.ts` | Full db export pre-execution | unit tests for pagination, fetch, JSON serialization, sha256 |
| `data-migrator.ts` | Per-instance backfill: read source prop value → write target prop value | unit tests per source-target type combination (file→file, string→string, string→reference via lookup, number→number, string list→string list) |
| `touch-saver.ts` | Re-write a formula property on every instance of a parent type | unit tests for instance enumeration + idempotent re-write |
| `phase-b-scope.ts` | The Phase B op list (mirrors `phase-a-scope.ts`) + bypassScope rules | unit tests verifying each §1–§5 op is enumerated correctly |

Existing modules used as-is: `entu-client.ts`, `schema-loader.ts`, `reporter.ts`, `v4e-translator.ts`. The `diff.ts` and `executor.ts` modules need **additions** (not rewrites) to handle the new op kinds — see §Implementation plan.

### Snapshot scope (Open item #2 — default: full db)

**Default:** export every entity in the polyphony db. Estimated size: 6 orgs + ~116 members + sections + people + works + editions + program_items + repertoire_items + events + ... ≈ a few hundred to ~1,000 entities. JSON output likely 1–10 MB. Manageable as a single committed artifact.

**Why not "only touched types":** scope filter could be wrong; a bug in our scope analysis could leave gaps. Full export is bulletproof; the cost is bounded; PO chose full export as the backup posture.

**Reviser:** if the snapshot turns out >100 MB or pagination becomes flaky, revisit. For now, default holds.

### Touch-save mechanism (Open item #3 — default: re-write the formula property)

**Default:** for each instance of the parent type, call `POST /entity/{id}` (Entu's update endpoint) with a property payload that re-asserts the formula field. This is the most explicit instruction to Entu to re-evaluate. Entu's behavior is then to re-run the formula expression and persist the computed value into the instance's property reading.

**Alternative (not chosen):** "no-op save" — PATCH the entity with `{}` in the property update body. Untested; potentially does nothing if Entu's diff layer detects no change.

**Empirical confirmation:** before live execution, Finn probes one `organization` instance on live db with the chosen method; verifies the `member_count_per_section` property reads the new (recursive-formula) value. Probe is part of the implementation-plan TDD chain, not this design spec.

## Open items (defaults flagged for review)

| # | Item | Default | Revisit if |
|---|---|---|---|
| 1 | Rename atomicity (one DAG node vs three) | **Three nodes** per rename: add + backfill + delete. Each independently idempotent. | We hit a rename where the source must be deleted *before* the target can be created (Entu name collision in metadata) — would force a different sequence. None expected in §1's list. |
| 2 | Snapshot scope | **Full db export** (every entity, every property). Single JSON file. | Snapshot exceeds 100 MB or fetch becomes flaky — switch to per-type-touched export. |
| 3 | Touch-save mechanism | **Re-write the formula property** on each instance, with the formula expression re-asserted. | Finn's empirical probe (Implementation-plan TDD chain) shows Entu does NOT re-eval on this write — fallback to "actually mutate then revert" pattern. |
| 4 | `section.voice_type` distinct-value enumeration | **Probe during dry-run.** Dry-run script lists all distinct `section.voice_type` string values, prints them, and confirms each maps to an exact-named `voice` entity. Mismatches halt with `unmatched_voice_type` error. | If polyphony's live data has voice_type values that don't match v4E's voice taxonomy (e.g., "T1" instead of "tenor1"), PO decides per-value mapping before script runs. |
| 5 | `person.forename`/`surname` deletion safety | **Verify materialized `name`** for all persons is non-empty before deleting. Any person with empty `name` → halt that delete; surface in report; do not auto-fix. | Polyphony has 0 persons with empty `name` (likely true, but probed). |

## Workflow

### TDD chain (matches Phase A)

| Phase | Owner | Deliverable |
|---|---|---|
| RED | Tallis | Vitest spec encoding §1–§5 ops with fixtures: mock db state + mock v4E schema → assert correct diff, correct ordering, correct sub-op enumeration, correct idempotency skips, correct partial-failure recovery. Snapshot module: fixture-based serialization tests. Data-migrator: per-type combo tests. Touch-saver: per-instance re-write + idempotency tests. |
| GREEN | Josquin | Script + new lib modules. Pattern-precedent: Phase A's modules in `scripts/migrations/lib/`. |
| (no i18n) | Comenius skipped | No user-facing strings. |
| REVIEW | Bentham | Script + spec cross-check + dry-run output review + snapshot artifact review + pre-execution sign-off. **New for Phase B:** Bentham's data-loss-risk checklist: (i) snapshot taken; (ii) renamed-prop instances backfilled BEFORE delete; (iii) delete only after backfill verifies clean; (iv) §4 formula update precedes §5 touch-save for the dependency chain. |
| MERGE | Josquin | After Bentham GREEN + PO go. |
| EXECUTE | PO (observed) + Palestrina | `pnpm exec tsx scripts/migrations/2026-05-20-phase-b.ts`. Bentham + PO review the report. |

### PR requirements

- Single mvox PR against `main`.
- Branch: `feat/phase-b-migration`.
- No `Schema-Change:` trailer (decision §Non-goals).
- Co-authored-by auto-attached via `prepare-commit-msg` hook.
- PR description includes the dry-run report output for the current db state PLUS the snapshot artifact reference (committed in a separate commit on the same branch).
- After PR merge AND post-execution run: a follow-up commit on `main` attaches the actual execution report + the actual pre-execution snapshot.

### Execution gate

PR is merged AFTER:

1. All vitest tests pass
2. Snapshot generation tested on a small fixture and works
3. Dry-run output reviewed by Bentham + PO (includes the §4 distinct-voice-type list)
4. Pre-execution snapshot taken on live polyphony db AND COMMITTED to repo
5. Bentham GREEN on the implementation
6. PO explicit go for execution

Execution happens within hours of merge (not days) — the snapshot's freshness matters.

### Lessons applied from Phase A (session 6)

Per `teams/mvox-dev/memory/team-lead.md` session 6 process lessons:

1. **Sequential checkpoint briefing** — Tallis + Josquin spawn messages for Phase B will include checkpoints baked in (not as follow-up messages). E.g., Josquin's brief lists: "checkpoint 1: implement snapshotter alone; checkpoint 2: data-migrator; checkpoint 3: touch-saver; checkpoint 4: integrate." Avoids the session-6 cross-fire pattern.
2. **Spec self-review trace** — before handing this spec to Tallis for RED, team-lead traces one example object (e.g., `section #X with voice_type='alto1'`) through every §1.3 sub-op and confirms the contract aligns with the test fixtures Tallis will likely build. If any inconsistency emerges, fix the spec BEFORE handoff.
3. **Persist research findings before designing on them** — Finn's `section.voice_type` distinct-value probe (Open item #4) MUST land as a committed file before the §1.3 rename's RED is written. Either `docs/migration/findings/section-voice-types-2026-05-XX.md` or appended to the divergence doc.
4. **Bentham proposing fixes in review** — healthy pattern from Phase A PR #26 YELLOW → PR #27. Welcome continued; don't push back.
5. **PO "merge if green automatically"** works — apply to Phase B PRs once Bentham GREEN, unless PO countermands.

## Out of scope

- Phase C / D scripts — separate specs.
- BFF code changes consuming renamed properties — CHORE-5 et al; coordinate with feature work as needed.
- Backup retention policy — committed snapshot lives in the repo; long-term storage is a separate decision (likely "keep in git history forever; that's cheap enough at <10 MB").
- Restore mechanism — out of scope. If we need to restore, hand-code a one-shot restore script using the snapshot JSON as input. (Hopefully unused.)

## References

- Handbook: [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md)
- Phase A design (template): [`docs/migration/specs/2026-05-19-phase-a-design.md`](2026-05-19-phase-a-design.md)
- Phase A implementation plan (template): [`docs/migration/specs/2026-05-19-phase-a-plan.md`](2026-05-19-phase-a-plan.md)
- Divergence audit: [`docs/migration/v4e-divergence-2026-05-19.md`](../v4e-divergence-2026-05-19.md) §4.3
- Phase A execution report: `scripts/migrations/reports/2026-05-19-phase-a-2026-05-20T03-46-18-833Z.{md,json}` (commit `a127729`)
- v4E schema source-of-truth: `~/projects/entu-research/docs/schema/v4E/schema.json`
- Architecture decisions: `teams/mvox-dev/memory/architecture-decisions.md`
- Way of Entu primer: [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md) §1.5

(*MVOX:Palestrina*)
