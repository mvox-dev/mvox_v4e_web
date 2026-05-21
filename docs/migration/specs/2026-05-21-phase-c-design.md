# Phase C — Live polyphony v4E structural-cleanup bundle

**Status:** design landed 2026-05-21; awaiting writing-plans + Bentham pre-execution review + auth-gate fire.

**Author:** (\*MVOX:Palestrina\*) — brainstormed with PO, session 10.

**Scope summary:** five-script DELETE-only bundle retiring four legacy polyphony types/properties that no longer match v4E `schema.ts` or the architecture-decisions on roles-as-rights. Estimated ~35–50 live ops total, all DELETEs, on minimal-instance surfaces (4 affiliation entities + 8 role property values + a handful of type-defs/prop-defs).

---

## Goal

Close the structural-cleanup gap left after Phases A / B / B.1 / D. Polyphony's live Entu db has four legacy artifacts:

- `inventory_copy` and `participation` types — type-defs exist but have **0 instances** (pre-v4E shape; future library-copy/lending and event-rsvp/attendance subtrees will re-introduce shape when frontend needs it).
- `affiliation` — 4 instances that are NOT person-affiliation joins; they're **collective↔umbrella federation links** that are structurally redundant with `_parent` (per the *Org rights isolation* decision in `architecture-decisions.md`).
- `member.role` — 8 stale Owner/Admin values on PO's 4 members. Duplicative of the `_owner` grants already on each collective (per the *roles as rights* decision; Phase D session-9 work already established `_owner` cascade-aware via `_inheritrights: false` on the org type).

After Phase C, live polyphony aligns with v4E `schema.ts` for the four cleanup surfaces. Forward-looking work (seed scripts, BFF contracts, frontend) consumes a cleaner shape.

**Out of scope (deferred):**
- Creating the eventual `copy` / `lending` library subtree or `rsvp` / `attendance` event subtree (frontend-driven; later phase).
- Additional `_inheritrights: false` flips beyond the session-9 org-type flip (e.g., on `section`).
- BFF code changes consuming the new rights model (Josquin's later work, post-Phase-C).
- Backfilling, anonymizing, or seeding new data of any kind — Phase C is pure cleanup.

## Source discovery

Pérotin's session-10 discovery probe (commit `a1aba7a`; findings at `docs/migration/findings/phase-c-discovery-2026-05-21.md`):

| Entity type | Instance count | Notes |
|---|---|---|
| `inventory_copy` | 0 | No instances |
| `participation` | 0 | No instances |
| `affiliation` | 4 | Collective↔umbrella federation links: `_parent → collective`, `umbrella → org`, `joined_at`, formula `name`. No `person` property anywhere. |
| `member.role` | 4 members × 2 values = 8 | PO's members only; "Owner" + "Admin" reference values. `role` is a reference prop pointing to `role`-type entities. |

PO decisions (session 10):
- **Affiliation:** delete all 4 instances + retire the type.
- **Role:** delete the 8 prop-values + retire the `role` prop on `member` + retire the role-type entities ("Owner", "Admin") + retire the role type-def.

## Pre-flight check

One Pérotin probe extends discovery to surface anything that would break under the Phase C deletes. Output: `docs/migration/findings/phase-c-preflight-2026-05-21.md` + JSON inventory of concrete IDs grouped per sub-op.

**The probe verifies:**

1. **Formula references** — grep all prop-def `formula` values for references to `affiliation.*`, `inventory_copy.*`, `participation.*`, `member.role`, `role.*`. Any hit means that formula breaks on cleanup — either kill the formula first or migrate its source.
2. **Reference-query picker scoping** — check whether any reference-typed property has `reference_query: { _type: '<retiring-type>' }`. Picker becomes a dead-end on type retire.
3. **Instance recount immediately pre-exec** — re-verify Pérotin's counts at execution time to catch drift between brainstorm and ship.
4. **Role-type entity inventory** — confirm count and capture concrete `_id`s for the "Owner" + "Admin" instances (and any other role-type instances that exist).
5. **Prop-def inventory per retiring type** — capture all prop-def `_id`s on `inventory_copy` / `participation` / `affiliation` / and the `role` prop-def on `member`.

**Halt conditions:** any formula reference OR any reference-query picker pointing at a retiring type triggers a STOP — PO escalation to decide kill-the-consumer vs preserve-the-source.

## Sub-op design

Five scripts under `scripts/migrations/cleanup-phase-c-*-2026-05-21.ts`. Each idempotent. Each emits a JSON result artifact in `scripts/migrations/seed-results/`. Bentham reviews each script pre-execution as a focused unit.

### C.1 — `cleanup-phase-c-inventory-copy-type`

Independent. Zero-instance type retirement.

1. Re-verify 0 instances of `inventory_copy` (halt on >0).
2. DELETE each prop-def entity on the `inventory_copy` type via `DELETE /entity/{id}`.
3. DELETE the `inventory_copy` type-def entity via `DELETE /entity/{id}`.
4. Artifact: `{ instances: 0, propDefsDeleted: [...ids], typeDefDeleted: id }`.

### C.2 — `cleanup-phase-c-participation-type`

Independent. Same shape as C.1.

1. Re-verify 0 instances of `participation` (halt on >0).
2. DELETE each prop-def entity on the `participation` type.
3. DELETE the `participation` type-def entity.
4. Artifact.

### C.3 — `cleanup-phase-c-affiliation`

Independent. 4 instances + type retire.

1. Re-verify 4 instances; capture full snapshot of each (`_id` + every property value) to a `preservation` block in the artifact. Deletion is irreversible; the artifact IS the data's afterlife.
2. DELETE each of the 4 affiliation entities via `DELETE /entity/{id}`.
3. Post-delete verify: list returns 0.
4. DELETE prop-defs on `affiliation`.
5. DELETE the `affiliation` type-def.
6. Artifact: pre-snapshot + post-confirm.

### C.4 — `cleanup-phase-c-member-role-property`

Must precede C.5. 8 prop-value deletes + prop-def retire.

1. For each of the 4 members: list `role` property values; capture `_id`s + reference targets to a `preservation` block in the artifact.
2. DELETE all 8 property-values via `DELETE /property/{value-id}` (Entu wire shape: property-value `_id`, not entity `_id`, per *Entu mutation-op wire shapes* in `architecture-decisions.md`).
3. Post-delete verify: each member has zero `role` values.
4. DELETE the `role` prop-def on the `member` type via `DELETE /entity/{prop-def-id}` (prop-defs ARE entities).
5. Artifact.

### C.5 — `cleanup-phase-c-role-type-entities`

Depends on C.4 completing. Role-type instances + type-def retire.

1. Re-verify zero member-side `role` references remain (post-C.4 cleanup).
2. List role-type instance entities ("Owner", "Admin"); capture `_id`s + values to artifact preservation block.
3. DELETE each role-type instance entity via `DELETE /entity/{id}`.
4. DELETE prop-defs on the `role` type.
5. DELETE the `role` type-def.
6. Artifact.

**Dependency edges:** C.4 → C.5. C.1, C.2, C.3 independent of each other and of C.4/C.5. Execution order is C.1 → C.2 → C.3 → C.4 → C.5 for narrative coherence and Bentham review tractability.

## Auth-gate + execution flow

Per session-9 codification (three-layer: Pérotin prompt + `feedback_authorization_gate` project memory + team-lead seed). Explicit `"I authorize this run"` SendMessage from team-lead is the **single** trigger for live mutation. Dry-run-clean + Bentham GREEN pre-execution are NOT substitutes.

**One gate fire covers the whole Phase C bundle.** Rationale: the gate exists to introduce friction at the human-judgment boundary; five separate fires for one designed-and-reviewed bundle is friction-without-added-safety and creates pressure to short-circuit. One gate, one bundle, halt-on-surprise.

**Flow:**

1. **Pre-flight probe** (Pérotin, no gate). Probe ships; team-lead + PO read findings. If formula references or reference-query pickers surface, Phase C pauses for re-design.
2. **Cleanup script development** (Pérotin, no gate). All 5 scripts written; each has working dry-run mode emitting the artifact shape. Dry-run is always free.
3. **Pre-execution review** (Bentham). All 5 scripts reviewed in a single dispatch (one Bentham activation), but verdicts are rendered **per-script** (RED/YELLOW/GREEN for C.1, C.2, C.3, C.4, C.5 independently) plus one overall verdict on dispatch readiness. RED on any individual script blocks the gate for the whole bundle; YELLOW notes are resolved before the gate fires.
4. **Auth-gate fire** (team-lead, after Bentham GREEN). Single SendMessage to Pérotin: `"I authorize this run"`.
5. **Live execution** (Pérotin, gated). Scripts execute serially: C.1 → C.2 → C.3 → C.4 → C.5. Each emits its result artifact on completion. **Halt-on-surprise:** any failure, any pre-flight-recount mismatch, any post-delete verify failure → STOP, report to team-lead, do NOT continue to next sub-op without re-dispatch.
6. **Post-execution review** (Bentham). Reads each artifact; renders post-execution verdict per sub-op. Surfaces any YELLOWs for follow-up commit (Phase D precedent: 5 YELLOWs bundled into one fix-up).
7. **Closeout** (team-lead). Close task #6 (migration in_progress) once Bentham GREENs the bundle. Phase C YELLOWs (if any) become their own follow-up task.

**Commit shape (proposed; Bentham may revise during pre-execution review):**

- 1 commit: pre-flight probe + findings doc (after step 1).
- 1 commit: 5 cleanup scripts + dry-run artifacts (after step 2; Bentham reviews this commit).
- 1 commit: live execution artifacts bundle (after step 5).
- 1 commit: post-execution YELLOWs fixup, only if any.

## Rollback / recovery posture

Pure DELETE bundle on tiny instance surface. Entu has no undelete API; rollback = recreate-by-shape from pre-delete snapshots.

**Mitigations:**

- Each sub-op's result artifact captures a **pre-delete preservation block** (full property snapshot of every entity/value about to die). The audit trail IS the rollback shape.
- **Halt-on-surprise** is the primary defense — don't deepen the loss.
- **Re-create-by-shape feasibility:** the 4 affiliation entities and the role-type instances can be POSTed back from snapshot data; IDs change but content preserved. The 8 role property values can be re-attached to the 4 members. Type-defs + prop-defs can be reconstructed from the v4E schema + the captured prop-def lists.
- **Bentham's pre-execution GREEN** is the cheap-to-acquire defense-in-depth net before the gate fires.

**Not in scope:** point-in-time DB snapshot. Entu has no documented snapshot API; the seed-data findings from session 4 settled this open question with "no formal backup; fix-forward acceptable for property-level destructive ops." Phase C destruction is property/instance-level only — within that policy.

## Acceptance criteria

Phase C is closed when:

- Pre-flight probe ships clean (no formula references or reference-query pickers blocking).
- Five cleanup scripts merged with dry-run artifacts.
- Bentham GREEN on the batch pre-execution.
- Live execution: each sub-op exits 0, each result artifact reflects the expected delete counts.
- Post-execution live state verifications:
  - `listInstancesByType('inventory_copy')` → 0
  - `listInstancesByType('participation')` → 0
  - `listInstancesByType('affiliation')` → 0
  - Each of the 4 members has 0 `role` property values
  - `listInstancesByType('role')` → 0 (Owner/Admin instances gone)
  - All 4 retiring type-defs return 404 on GET
- Bentham post-execution GREEN bundle verdict.
- Task #6 (Polyphony db → v4E migration) closeable.
- Any Phase C YELLOWs tracked as a follow-up task with named owner.

## Open questions

All open questions at brainstorm time were resolved:

- Bundle vs sub-phases: **bundle** (one Phase C design, all five sub-ops in one execution).
- Affiliation disposition: **delete all + retire type**.
- Role disposition: **delete property + prop-def + role-type entities + role type-def**.
- Script shape: **five-script Phase D precedent** (one per sub-op).
- Auth-gate cadence: **one gate fire for the bundle**.
- Sub-op order: **C.1 → C.2 → C.3 → C.4 → C.5** (only C.4 → C.5 is a hard dependency edge).

## References

- `docs/migration/findings/phase-c-discovery-2026-05-21.md` — Pérotin's instance-count discovery.
- `teams/mvox-dev/memory/architecture-decisions.md` — "Entu formula-to-plain conversion mechanic", "Entu mutation-op wire shapes", "Org rights isolation", "Roles as rights" (in the polyphony schema decisions block).
- `docs/migration/specs/2026-05-19-phase-a-design.md` and Phase B/D specs — script-bundle precedents.
- Pérotin prompt — `teams/mvox-dev/prompts/perotin.md` — auth-gate language.

(*MVOX:Palestrina*)
