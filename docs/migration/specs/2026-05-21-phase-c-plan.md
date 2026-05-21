# Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a five-script DELETE-only cleanup bundle that retires `inventory_copy`, `participation`, `affiliation`, and `member.role` from live polyphony Entu, aligning the live db with v4E `schema.ts` and the roles-as-rights architecture decision.

**Architecture:** Five idempotent TypeScript scripts under `scripts/migrations/cleanup-phase-c-*-2026-05-21.ts`, each consuming Pérotin's pre-flight probe inventory for concrete IDs. Each script supports DRY_RUN mode (default true) emitting an artifact shape identical to its live-mode output, sans live writes. Serial execution under a single team-lead `"I authorize this run"` gate fire. Halt-on-surprise: any failure / pre-flight recount mismatch / post-delete verify failure halts the bundle and re-dispatches to team-lead. Pattern matches Phase D (5 cleanup scripts, session 9).

**Tech Stack:** TypeScript via `pnpm exec tsx`; Entu API via `scripts/migrations/lib/entu-client.ts` (Josquin-owned primitives); Pérotin toolkit at `scripts/migrations/perotin-lib/` (idempotency, artifact writers, dry-run guards); JSON result artifacts under `scripts/migrations/seed-results/`.

**Team:** Pérotin owns Tasks 1-6 + 8 (script authoring + live execution). Bentham owns Tasks 7 + 9 (pre- and post-execution reviews). Team-lead orchestrates handoffs + fires the auth-gate (Task 8).

---

## File structure

**Created by this plan:**

- `scripts/migrations/probes/probe-phase-c-preflight-2026-05-21.ts` — pre-flight probe (Task 1)
- `docs/migration/findings/phase-c-preflight-2026-05-21.md` — preflight findings (Task 1)
- `scripts/migrations/seed-results/probe-phase-c-preflight-<ISO-ts>.json` — preflight probe artifact (Task 1 output)
- `scripts/migrations/cleanup-phase-c-inventory-copy-type-2026-05-21.ts` (Task 2)
- `scripts/migrations/cleanup-phase-c-participation-type-2026-05-21.ts` (Task 3)
- `scripts/migrations/cleanup-phase-c-affiliation-2026-05-21.ts` (Task 4)
- `scripts/migrations/cleanup-phase-c-member-role-property-2026-05-21.ts` (Task 5)
- `scripts/migrations/cleanup-phase-c-role-type-entities-2026-05-21.ts` (Task 6)
- `scripts/migrations/seed-results/cleanup-phase-c-*-<ISO-ts>.json` — one per script per run (Tasks 2-6 dry-run, Task 8 live)

**Not touched (out of scope per spec):**

- `src/` — production source unchanged in Phase C
- `scripts/migrations/lib/*.ts` — Josquin-owned; consume but don't modify
- Any v4E schema files in `entu/research`

---

## Task 1: Pre-flight probe + findings

**Owner:** Pérotin

**Files:**

- Create: `scripts/migrations/probes/probe-phase-c-preflight-2026-05-21.ts`
- Create: `docs/migration/findings/phase-c-preflight-2026-05-21.md`
- Output: `scripts/migrations/seed-results/probe-phase-c-preflight-<ISO-ts>.json`

**Pattern reference:** `scripts/migrations/probes/probe-phase-d-discovery-2026-05-21.ts` (session-9 commit `da711f2`) and `scripts/migrations/probes/probe-mutation-ops-2026-05-20.ts` (session-8 commit `a6ed6bb`).

- [ ] **Step 1.1: Author probe script.** Script reads-only against live Entu. Must capture and emit to artifact:

  1. **Formula reference scan.** For every prop-def entity across all type-defs in polyphony, read its `formula` value (if any). Test against the regex set:
     - `/\baffiliation\b/`
     - `/\binventory_copy\b/`
     - `/\bparticipation\b/`
     - `/\bmember\.\*\.role\b/` and `/\brole\.\*/`
     For each hit: record consuming type, prop-def `_id`, prop name, full formula string. Output array `formulaReferences: [...]`.

  2. **Reference-query picker scan.** For every reference-typed property prop-def, parse its `reference_query` JSON. If the query specifies `_type` equal to any of `'inventory_copy'`, `'participation'`, `'affiliation'`, or `'role'`, record consuming type, prop-def `_id`, prop name, full reference_query. Output array `referenceQueryPickers: [...]`.

  3. **Instance recounts.** Re-verify Pérotin's session-10 discovery (commit `a1aba7a`):
     - `listInstancesByType('inventory_copy')` → record count; expect 0
     - `listInstancesByType('participation')` → record count; expect 0
     - `listInstancesByType('affiliation')` → record count + capture each instance's `_id`, `_parent`, `umbrella`, `joined_at`, `name` to `affiliationInstances: [...]`
     - For each of the 4 known PO-member IDs (from `a1aba7a` findings): list their role values; capture each value's `_id` + reference target. Output `memberRoleValues: [memberAId: [valueA1Id, valueA2Id], ...]`.

  4. **Role-type entity inventory.** `listInstancesByType('role')` → capture every role-type instance entity's `_id` + display name (e.g., "Owner", "Admin"). Output `roleTypeInstances: [...]`.

  5. **Prop-def inventory per retiring type.** For `inventory_copy`, `participation`, `affiliation`, and the `role` *type*: list all prop-def entities on each (via the type-def's `_child` traversal). For `member` type: list only the `role` prop-def. Capture `_id` + prop name + type per prop-def. Output `propDefs: { inventory_copy: [...], participation: [...], affiliation: [...], roleType: [...], memberRole: { _id, name } }`.

  6. **Type-def entity IDs.** Capture the type-def entity `_id` for each of `inventory_copy`, `participation`, `affiliation`, and the `role` type. Output `typeDefIds: { inventory_copy, participation, affiliation, role }`.

  Exit 0 on success, 1 on any read failure.

- [ ] **Step 1.2: Run probe live (read-only; auth-gate NOT required).** Command:

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  pnpm exec tsx scripts/migrations/probes/probe-phase-c-preflight-2026-05-21.ts
  ```

  Expected: exit 0; JSON artifact at `scripts/migrations/seed-results/probe-phase-c-preflight-<ISO-ts>.json`.

- [ ] **Step 1.3: Verify artifact contents.** Inspect the JSON. Check:
  - `formulaReferences` length (any value > 0 is a halt-condition)
  - `referenceQueryPickers` length (any value > 0 is a halt-condition)
  - Instance recount values match Pérotin's session-10 numbers from `a1aba7a` (deltas mean drift; investigate before proceeding)
  - All `propDefs` arrays + `typeDefIds` are populated

- [ ] **Step 1.4: Author findings doc.** Write `docs/migration/findings/phase-c-preflight-2026-05-21.md` summarizing:
  - Confirmed instance counts (or drift from `a1aba7a`)
  - Formula-reference matches (or "none — clean to proceed")
  - Reference-query picker matches (or "none — clean to proceed")
  - Halt-condition status: GO or HALT (with reason)
  - Inventory summary: total IDs captured per retiring type
  - Recommendation to team-lead/PO: proceed to Task 2-6 (script dev) OR pause for spec revision

- [ ] **Step 1.5: Commit.** Branch: `main` (probe + findings, no live mutation).

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/probes/probe-phase-c-preflight-2026-05-21.ts docs/migration/findings/phase-c-preflight-2026-05-21.md scripts/migrations/seed-results/probe-phase-c-preflight-*.json
  git commit -m "chore(migration): Phase C pre-flight probe + findings"
  git push origin main
  ```

- [ ] **Step 1.6: Report to team-lead.** SendMessage with findings doc path + halt-condition status. If HALT, team-lead escalates to PO before Task 2 begins.

**Halt condition for the entire bundle:** Step 1.3 OR Step 1.4 surfaces any `formulaReferences` or `referenceQueryPickers`. Tasks 2-6 do not begin until PO settles the consumer (kill formula vs preserve source).

---

## Task 2: `cleanup-phase-c-inventory-copy-type`

**Owner:** Pérotin

**Depends on:** Task 1 complete and GO; preflight findings supply the concrete prop-def IDs and type-def ID.

**Files:**

- Create: `scripts/migrations/cleanup-phase-c-inventory-copy-type-2026-05-21.ts`
- Output (dry-run): `scripts/migrations/seed-results/cleanup-phase-c-inventory-copy-type-<ISO-ts>.json`

**Pattern reference:** `scripts/migrations/cleanup-phase-d-forename-surname-2026-05-21.ts` (zero-instance type retirement; commit `10e1c2c` after the Phase D YELLOW fixup commit).

- [ ] **Step 2.1: Author script.** Script must:

  - Read `DRY_RUN` env var; treat any value other than `"false"` (case-sensitive) as dry-run mode. Default = dry-run.
  - Authenticate via `getJwt({apiBase, db, apiKey})` from `scripts/migrations/lib/entu-client.ts`. Verify `accounts` non-empty (auth probe).
  - **Pre-flight verification:** read instance count for `inventory_copy` via `listInstancesByType('inventory_copy')`. If count > 0, log error to stderr and exit 1. (The bundle was designed for zero instances; non-zero is a halt.)
  - **For each prop-def `_id` on the `inventory_copy` type** (consumed from `propDefs.inventory_copy` in the preflight artifact):
    - In live mode: `DELETE /entity/{prop-def-id}` via the toolkit's entity-delete wrapper.
    - In dry-run mode: log the would-delete to stdout; do not call DELETE.
    - Record outcome (deleted / would-delete / failed) in artifact `propDefsResult: [{id, name, outcome}]`.
  - **For the `inventory_copy` type-def entity `_id`** (consumed from `typeDefIds.inventory_copy`):
    - In live mode: `DELETE /entity/{type-def-id}`.
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `typeDefResult: {id, outcome}`.
  - Write result artifact to `scripts/migrations/seed-results/cleanup-phase-c-inventory-copy-type-<ISO-ts>.json` with shape:

    ```json
    {
      "phase": "C.1",
      "script": "cleanup-phase-c-inventory-copy-type",
      "dryRun": true,
      "startedAt": "2026-05-21T...",
      "completedAt": "2026-05-21T...",
      "initialInstances": 0,
      "propDefsResult": [{"id": "...", "name": "...", "outcome": "would-delete|deleted|failed"}],
      "typeDefResult": {"id": "...", "outcome": "would-delete|deleted|failed"},
      "exitCode": 0,
      "errors": []
    }
    ```

  - Exit 0 on success; 1 on any failure (record failure detail in `errors`).

- [ ] **Step 2.2: Run dry-run.** Command:

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-inventory-copy-type-2026-05-21.ts
  ```

  Expected: exit 0; artifact written; `dryRun: true`; `propDefsResult[].outcome` = `"would-delete"` for every entry matching `propDefs.inventory_copy` from preflight; `typeDefResult.outcome` = `"would-delete"`.

- [ ] **Step 2.3: Verify artifact.** Open the JSON. Confirm:
  - `dryRun: true`
  - `initialInstances: 0`
  - `propDefsResult.length` matches preflight `propDefs.inventory_copy.length`
  - Every `propDefsResult[].id` is in preflight `propDefs.inventory_copy`
  - `typeDefResult.id` matches preflight `typeDefIds.inventory_copy`
  - `errors: []`

- [ ] **Step 2.4: Commit.** Add script + dry-run artifact only. Live run is held for Task 8.

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/cleanup-phase-c-inventory-copy-type-2026-05-21.ts scripts/migrations/seed-results/cleanup-phase-c-inventory-copy-type-*.json
  git commit -m "chore(migration): Phase C.1 script + dry-run artifact (inventory_copy type retire)"
  git push origin main
  ```

---

## Task 3: `cleanup-phase-c-participation-type`

**Owner:** Pérotin

**Depends on:** Task 1 complete and GO.

**Files:**

- Create: `scripts/migrations/cleanup-phase-c-participation-type-2026-05-21.ts`
- Output (dry-run): `scripts/migrations/seed-results/cleanup-phase-c-participation-type-<ISO-ts>.json`

**Pattern reference:** Same as Task 2 — zero-instance type retirement. Structurally identical script with `inventory_copy` → `participation` throughout.

- [ ] **Step 3.1: Author script** — copy structure of Task 2's script, substituting:
  - All instances of `inventory_copy` (in `listInstancesByType`, preflight key lookups, artifact `phase` and `script` fields) with `participation`.
  - Artifact `phase: "C.2"`, `script: "cleanup-phase-c-participation-type"`.
  - Consume `propDefs.participation` and `typeDefIds.participation` from preflight artifact.

- [ ] **Step 3.2: Run dry-run.**

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-participation-type-2026-05-21.ts
  ```

  Expected: exit 0; artifact written; same shape as Task 2 but for `participation`.

- [ ] **Step 3.3: Verify artifact.** Same checks as Step 2.3 but against `propDefs.participation` / `typeDefIds.participation`.

- [ ] **Step 3.4: Commit.**

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/cleanup-phase-c-participation-type-2026-05-21.ts scripts/migrations/seed-results/cleanup-phase-c-participation-type-*.json
  git commit -m "chore(migration): Phase C.2 script + dry-run artifact (participation type retire)"
  git push origin main
  ```

---

## Task 4: `cleanup-phase-c-affiliation`

**Owner:** Pérotin

**Depends on:** Task 1 complete and GO.

**Files:**

- Create: `scripts/migrations/cleanup-phase-c-affiliation-2026-05-21.ts`
- Output (dry-run): `scripts/migrations/seed-results/cleanup-phase-c-affiliation-<ISO-ts>.json`

**Pattern reference:** Closest analog is `cleanup-phase-d-org-rights-2026-05-21.ts` (multi-instance loop with per-instance preservation + post-write capture).

- [ ] **Step 4.1: Author script.** Script must:

  - Read `DRY_RUN` env var as in Task 2.
  - Authenticate via `getJwt`.
  - **Pre-flight verification:** `listInstancesByType('affiliation')` → expect 4 instances (from preflight). If count != 4, log error to stderr and exit 1.
  - **Preservation snapshot:** for each of the 4 affiliation instances (using `_id`s from preflight `affiliationInstances`), fetch the full entity via `GET /entity/{id}`, capture every property + value to `preservation: [{_id, properties: {...}}, ...]` in the artifact. This is the audit trail; deletion is irreversible.
  - **For each affiliation instance `_id`** (from preflight `affiliationInstances`):
    - In live mode: `DELETE /entity/{instance-id}`.
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `instanceResult: [{id, outcome}]`.
  - **Post-delete verification** (live mode only): `listInstancesByType('affiliation')` → must return 0. If not 0, log error, set artifact `postDeleteVerified: false`, exit 1. If 0, set `postDeleteVerified: true`.
  - **For each prop-def `_id` on the `affiliation` type** (from preflight `propDefs.affiliation`):
    - In live mode: `DELETE /entity/{prop-def-id}`.
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `propDefsResult: [{id, name, outcome}]`.
  - **For the `affiliation` type-def entity `_id`** (from preflight `typeDefIds.affiliation`):
    - In live mode: `DELETE /entity/{type-def-id}`.
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `typeDefResult: {id, outcome}`.
  - Artifact shape:

    ```json
    {
      "phase": "C.3",
      "script": "cleanup-phase-c-affiliation",
      "dryRun": true,
      "startedAt": "...",
      "completedAt": "...",
      "initialInstances": 4,
      "preservation": [{"_id": "...", "properties": {...}}, ...],
      "instanceResult": [{"id": "...", "outcome": "..."}],
      "postDeleteVerified": null,
      "propDefsResult": [...],
      "typeDefResult": {...},
      "exitCode": 0,
      "errors": []
    }
    ```

    (In dry-run mode `postDeleteVerified` is `null` because no instances were actually deleted.)

  - Exit 0 on success; 1 on any failure.

- [ ] **Step 4.2: Run dry-run.**

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-affiliation-2026-05-21.ts
  ```

  Expected: exit 0; artifact written; `preservation` length = 4; `instanceResult` length = 4; every `outcome: "would-delete"`.

- [ ] **Step 4.3: Verify artifact.**
  - `dryRun: true`, `initialInstances: 4`
  - `preservation.length: 4` and each entry has full property snapshot
  - `instanceResult.length: 4` with every `outcome: "would-delete"`
  - `postDeleteVerified: null`
  - `propDefsResult.length` matches preflight `propDefs.affiliation.length`
  - `typeDefResult.id` matches preflight `typeDefIds.affiliation`

- [ ] **Step 4.4: Commit.**

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/cleanup-phase-c-affiliation-2026-05-21.ts scripts/migrations/seed-results/cleanup-phase-c-affiliation-*.json
  git commit -m "chore(migration): Phase C.3 script + dry-run artifact (affiliation 4-instance + type retire)"
  git push origin main
  ```

---

## Task 5: `cleanup-phase-c-member-role-property`

**Owner:** Pérotin

**Depends on:** Task 1 complete and GO. Must precede Task 6 in live execution (Task 8).

**Files:**

- Create: `scripts/migrations/cleanup-phase-c-member-role-property-2026-05-21.ts`
- Output (dry-run): `scripts/migrations/seed-results/cleanup-phase-c-member-role-property-<ISO-ts>.json`

**Pattern reference:** `cleanup-phase-d-name-to-plain-2026-05-21.ts` for per-member iteration with property-value preservation; combined with the property-value DELETE wire shape (`DELETE /property/{value-id}` per architecture-decisions "Entu mutation-op wire shapes").

- [ ] **Step 5.1: Author script.** Script must:

  - Read `DRY_RUN` env var as in Task 2.
  - Authenticate via `getJwt`.
  - **Pre-flight verification:** read preflight `memberRoleValues` (shape: `{memberId: [valueId1, valueId2], ...}`). Verify total value count = 8 across the 4 member keys. If not 8, log error to stderr and exit 1.
  - **Preservation snapshot:** for each member key in `memberRoleValues`, fetch the member entity, capture the full `role` property array (value `_id`s + reference targets + reference display strings) to `preservation: [{memberId, roleValues: [{_id, reference, displayName}, ...]}, ...]`.
  - **For each value `_id` across all 4 members** (8 total):
    - In live mode: `DELETE /property/{value-id}` (property-value endpoint, NOT entity).
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `valueDeletions: [{memberId, valueId, outcome}]`.
  - **Post-delete verification** (live mode only): for each member key, fetch the member entity, verify `role` property returns 0 values. If any member still has role values, log error, set artifact `postDeleteVerified: false`, exit 1. Otherwise `postDeleteVerified: true`.
  - **For the `role` prop-def `_id` on `member` type** (from preflight `propDefs.memberRole._id`):
    - In live mode: `DELETE /entity/{prop-def-id}` (prop-def is an entity).
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `propDefResult: {id, name, outcome}`.
  - Artifact shape:

    ```json
    {
      "phase": "C.4",
      "script": "cleanup-phase-c-member-role-property",
      "dryRun": true,
      "startedAt": "...",
      "completedAt": "...",
      "initialValueCount": 8,
      "preservation": [{"memberId": "...", "roleValues": [...]}, ...],
      "valueDeletions": [{"memberId": "...", "valueId": "...", "outcome": "..."}],
      "postDeleteVerified": null,
      "propDefResult": {"id": "...", "name": "role", "outcome": "..."},
      "exitCode": 0,
      "errors": []
    }
    ```

  - Exit 0 on success; 1 on any failure.

- [ ] **Step 5.2: Run dry-run.**

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-member-role-property-2026-05-21.ts
  ```

  Expected: exit 0; artifact written; `valueDeletions.length: 8`; every outcome `"would-delete"`.

- [ ] **Step 5.3: Verify artifact.**
  - `dryRun: true`, `initialValueCount: 8`
  - `preservation.length: 4` (4 members)
  - `valueDeletions.length: 8` with every `outcome: "would-delete"`
  - `postDeleteVerified: null`
  - `propDefResult.id` matches preflight `propDefs.memberRole._id`

- [ ] **Step 5.4: Commit.**

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/cleanup-phase-c-member-role-property-2026-05-21.ts scripts/migrations/seed-results/cleanup-phase-c-member-role-property-*.json
  git commit -m "chore(migration): Phase C.4 script + dry-run artifact (member.role 8-value + prop-def retire)"
  git push origin main
  ```

---

## Task 6: `cleanup-phase-c-role-type-entities`

**Owner:** Pérotin

**Depends on:** Task 1 complete and GO. In live execution (Task 8), runs ONLY after Task 5's live execution succeeded (post-delete verification confirmed zero member-side role references).

**Files:**

- Create: `scripts/migrations/cleanup-phase-c-role-type-entities-2026-05-21.ts`
- Output (dry-run): `scripts/migrations/seed-results/cleanup-phase-c-role-type-entities-<ISO-ts>.json`

**Pattern reference:** Combination of zero-instance type retirement (Task 2 shape, for prop-defs + type-def) with instance preservation snapshot (Task 4 shape, for the role-type instance entities).

- [ ] **Step 6.1: Author script.** Script must:

  - Read `DRY_RUN` env var as in Task 2.
  - Authenticate via `getJwt`.
  - **Pre-flight verification:** `listInstancesByType('role')` → expect the same count as preflight `roleTypeInstances.length`. If mismatched, log error to stderr and exit 1.
  - **Cross-script gate:** in live mode, also re-verify zero member-side `role` references. For each member key from preflight `memberRoleValues`, fetch the member entity, assert `role` property has 0 values. If any member still has role values (i.e., Task 5 live run incomplete), log error, exit 1 — DO NOT proceed to delete role-type instances.
  - **Preservation snapshot:** for each role-type instance from preflight `roleTypeInstances`, fetch the entity, capture full properties to `preservation: [{_id, properties: {...}}, ...]`.
  - **For each role-type instance `_id`** (from preflight `roleTypeInstances`):
    - In live mode: `DELETE /entity/{instance-id}`.
    - In dry-run mode: log the would-delete.
    - Record outcome in artifact `instanceResult: [{id, displayName, outcome}]`.
  - **Post-delete verification** (live mode only): `listInstancesByType('role')` → must return 0. Set `postDeleteVerified` accordingly.
  - **For each prop-def `_id` on the `role` type** (from preflight `propDefs.roleType`):
    - In live mode: `DELETE /entity/{prop-def-id}`.
    - In dry-run mode: log.
    - Record outcome in artifact `propDefsResult: [{id, name, outcome}]`.
  - **For the `role` type-def entity `_id`** (from preflight `typeDefIds.role`):
    - In live mode: `DELETE /entity/{type-def-id}`.
    - In dry-run mode: log.
    - Record outcome in artifact `typeDefResult: {id, outcome}`.
  - Artifact shape:

    ```json
    {
      "phase": "C.5",
      "script": "cleanup-phase-c-role-type-entities",
      "dryRun": true,
      "startedAt": "...",
      "completedAt": "...",
      "initialInstances": 2,
      "preservation": [...],
      "instanceResult": [...],
      "postDeleteVerified": null,
      "propDefsResult": [...],
      "typeDefResult": {...},
      "exitCode": 0,
      "errors": []
    }
    ```

  - Exit 0 on success; 1 on any failure.

- [ ] **Step 6.2: Run dry-run.**

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-role-type-entities-2026-05-21.ts
  ```

  Expected: exit 0; artifact written; `instanceResult.length` matches preflight `roleTypeInstances.length`; every outcome `"would-delete"`.

- [ ] **Step 6.3: Verify artifact.**
  - `dryRun: true`, `initialInstances` matches preflight
  - `preservation.length` matches preflight `roleTypeInstances.length`
  - `instanceResult` every `outcome: "would-delete"`
  - `propDefsResult.length` matches preflight `propDefs.roleType.length`
  - `typeDefResult.id` matches preflight `typeDefIds.role`

- [ ] **Step 6.4: Commit.**

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/cleanup-phase-c-role-type-entities-2026-05-21.ts scripts/migrations/seed-results/cleanup-phase-c-role-type-entities-*.json
  git commit -m "chore(migration): Phase C.5 script + dry-run artifact (role-type instances + type retire)"
  git push origin main
  ```

---

## Task 7: Bentham batch pre-execution review

**Owner:** Bentham

**Depends on:** Tasks 2-6 all complete; all five script commits on `origin/main`; all five dry-run artifacts present and validated.

**Inputs:** the 5 commits from Tasks 2-6 (one per sub-op).

- [ ] **Step 7.1: Team-lead dispatches Bentham** via SendMessage with: list of 5 commit SHAs, link to design spec (`docs/migration/specs/2026-05-21-phase-c-design.md`), and the preflight findings doc.

- [ ] **Step 7.2: Bentham reviews each script** (read-only — no write authority per common-prompt). For each of C.1, C.2, C.3, C.4, C.5:
  - Verify script matches its design intent (Section 3 of the spec)
  - Verify dry-run artifact matches expected shape (Steps N.3 of the corresponding task)
  - Verify wire shapes: entity DELETE vs property-value DELETE used per the architecture-decisions table
  - Verify halt-on-surprise paths are present (pre-flight verification + post-delete verification)
  - Verify preservation snapshot blocks are populated where the design requires (C.3, C.4, C.5)
  - Verify dry-run mode is the default (DRY_RUN env var)
  - Render verdict: RED / YELLOW / GREEN per-script

- [ ] **Step 7.3: Bentham issues batch verdict** via SendMessage to team-lead:
  - Per-script RED/YELLOW/GREEN
  - Overall bundle dispatch-readiness verdict (any RED blocks; YELLOW notes resolved before gate)
  - Recommended fix-up steps if any (to be done by Pérotin in a fix-up commit BEFORE the gate fires)

- [ ] **Step 7.4: Resolve YELLOW notes if any** (Pérotin fix-up commit) and re-run Steps 7.2-7.3 until Bentham GREENs the bundle.

---

## Task 8: Auth-gate fire + serial live execution

**Owner:** Team-lead (gate fire) + Pérotin (execution).

**Depends on:** Task 7 GREEN.

- [ ] **Step 8.1: Team-lead fires the auth-gate** via SendMessage to Pérotin with the exact token: `"I authorize this run"`. No conditional language. No "if everything looks right" — the gate is explicit.

- [ ] **Step 8.2: Pérotin runs C.1 live** — `cleanup-phase-c-inventory-copy-type-2026-05-21.ts` with `DRY_RUN=false`:

  ```bash
  set -a; . ~/.config/mvox/credentials.env; set +a
  DRY_RUN=false pnpm exec tsx scripts/migrations/cleanup-phase-c-inventory-copy-type-2026-05-21.ts
  ```

  Expected: exit 0; live result artifact written; `dryRun: false`; every outcome `"deleted"`.

- [ ] **Step 8.3: Pérotin verifies C.1 artifact.** Confirm `dryRun: false`, `initialInstances: 0`, every `propDefsResult[].outcome: "deleted"`, `typeDefResult.outcome: "deleted"`, `errors: []`. **If any failure, HALT — do not proceed to C.2. Report to team-lead.**

- [ ] **Step 8.4: Pérotin runs C.2 live** — same shape as 8.2 with `cleanup-phase-c-participation-type-2026-05-21.ts`. Verify artifact per Step 8.3 criteria but for participation. **Halt on any failure.**

- [ ] **Step 8.5: Pérotin runs C.3 live** — `cleanup-phase-c-affiliation-2026-05-21.ts` with `DRY_RUN=false`. Verify artifact: every of 4 `instanceResult[].outcome: "deleted"`, `postDeleteVerified: true`, every of `propDefsResult[].outcome: "deleted"`, `typeDefResult.outcome: "deleted"`, `errors: []`. **Halt on any failure.**

- [ ] **Step 8.6: Pérotin runs C.4 live** — `cleanup-phase-c-member-role-property-2026-05-21.ts` with `DRY_RUN=false`. Verify artifact: every of 8 `valueDeletions[].outcome: "deleted"`, `postDeleteVerified: true`, `propDefResult.outcome: "deleted"`, `errors: []`. **Halt on any failure.** (C.4 → C.5 is a hard dependency; C.5 must NOT run if C.4 halted.)

- [ ] **Step 8.7: Pérotin runs C.5 live** — `cleanup-phase-c-role-type-entities-2026-05-21.ts` with `DRY_RUN=false`. Verify artifact: cross-script gate confirmed (zero member-side role refs), all role-type instances deleted, postDeleteVerified true, prop-defs deleted, type-def deleted, errors empty. **Halt on any failure.**

- [ ] **Step 8.8: Pérotin commits all 5 live artifacts in a single bundle commit.**

  ```bash
  git checkout main
  git pull
  git add scripts/migrations/seed-results/cleanup-phase-c-*-*.json
  git commit -m "chore(migration): Phase C live execution artifacts (C.1-C.5 bundle)"
  git push origin main
  ```

  Note: the commit captures ONLY the live-mode artifacts. Dry-run artifacts from Tasks 2-6 are already on main.

- [ ] **Step 8.9: Pérotin reports completion** to team-lead via SendMessage with: 5 artifact paths, bundle commit SHA, post-execution live state summary (counts confirmed zero).

---

## Task 9: Bentham post-execution review + Phase C closeout

**Owner:** Bentham (review) + team-lead (closeout).

**Depends on:** Task 8 complete.

- [ ] **Step 9.1: Team-lead dispatches Bentham** for post-execution review. Include the live-execution bundle commit SHA and the 5 artifact paths.

- [ ] **Step 9.2: Bentham reviews each live artifact.** For each of C.1-C.5:
  - Confirm `dryRun: false`
  - Confirm initialInstances/initialValueCount matches preflight expectations
  - Confirm every `outcome: "deleted"` (no `failed`)
  - Confirm `postDeleteVerified: true` (for C.3, C.4, C.5)
  - Confirm `errors: []`
  - Render post-execution verdict per-script: GREEN / YELLOW (with recommended fix-up commit)

- [ ] **Step 9.3: Bentham issues bundle verdict** via SendMessage to team-lead:
  - Per-script post-execution verdict
  - Overall bundle GREEN/YELLOW status
  - Phase D-style YELLOW carry-forwards (if any) — these become a Phase C fix-up task

- [ ] **Step 9.4: Team-lead closes Phase C.** If Bentham GREENs the bundle:
  - Update task #6 (`Polyphony db → v4E migration (in-place)`) to `completed` in the team task list (per Acceptance Criteria in the spec)
  - If any YELLOWs from Step 9.3: create a new follow-up task ("Phase C YELLOW fix-up commit") similar to Phase D's task #64; route to Pérotin
  - Final live state verification (team-lead-run, read-only): query Entu for each AC bullet in the spec; confirm 404s on retired type-defs and 0 counts on retired types

- [ ] **Step 9.5: Team-lead reports closure** to PO via the chat. Includes: bundle commit SHAs, AC verification results, any YELLOW carry-forward summary.

---

## Self-review checklist (skill-mandated)

**Spec coverage:** Every section of the spec maps to one or more tasks:
- Spec "Pre-flight check" → Task 1
- Spec "Sub-op design" C.1 → Task 2
- Spec "Sub-op design" C.2 → Task 3
- Spec "Sub-op design" C.3 → Task 4
- Spec "Sub-op design" C.4 → Task 5
- Spec "Sub-op design" C.5 → Task 6
- Spec "Auth-gate + execution flow" steps 1-2 → Tasks 1-6
- Spec "Auth-gate + execution flow" step 3 → Task 7
- Spec "Auth-gate + execution flow" steps 4-5 → Task 8
- Spec "Auth-gate + execution flow" steps 6-7 → Task 9
- Spec "Rollback / recovery" → captured as preservation blocks in C.3/C.4/C.5 artifacts (Tasks 4/5/6)
- Spec "Acceptance criteria" → Step 9.4

**Type consistency:** Artifact field names (`dryRun`, `initialInstances`, `preservation`, `instanceResult`, `propDefsResult`, `typeDefResult`, `postDeleteVerified`, `valueDeletions`, `propDefResult`, `outcome`, `errors`, `phase`, `script`) used consistently across all five task descriptions.

**No placeholders:** Every step describes a concrete action or shows the artifact shape. No `TBD`, no `implement appropriately`, no `add error handling` without specification.

**Halt-on-surprise present:** Each live-execution step (8.3, 8.4, 8.5, 8.6, 8.7) explicitly says "Halt on any failure" with the criteria for failure spelled out. C.4 → C.5 cross-script gate explicit in Step 6.1 and 8.7.

(*MVOX:Palestrina*)
