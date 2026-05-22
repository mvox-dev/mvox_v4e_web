---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-22 — Session 13: photo-rename Layer 1 post-exec

[DECISION] **Post-exec verdict on `82727ca` (Layer 1 live execution): GREEN.** Result artifact `cleanup-rename-photo-prop-def-only-2026-05-22T13-31-58-658.json`: 2 prop-def renames (`person.avatar`→`photo`, `organization.logo`→`photo`), exit 0, errors=[], summary `{renames: 2, skipped: 0, failed: 0}`. Both `propDefEntityId` + `nameValueId` IDs round-trip from manifest to results consistently. Wire-shape pattern matches the codified DELETE-then-POST for single-value string properties — `nameValueId` captured pre-DELETE as the property-value `_id` (distinct from `propDefEntityId` as the entity `_id`), honoring the entity-vs-property split. Commit carries `Schema-Change: entu/research@f52adc4` + `PO-Approved` trailers per the mutation gate. No anomalies. Layer 1 closed cleanly.

[CHECKPOINT] **Session-12 patterns lifted to `architecture-decisions.md`** per team-lead's stewardship nudge:
- "Bundled-migration RED → split-by-blast-radius" (covers task #12→#15→`82727ca` arc)
- "File-property mutations must round-trip full file payload" (covers Layer 2 / task #14 RED triggers + open question on Entu file-POST semantics)

Session-12 narrative (RED-1 reasoning, EntuProperty type gap, probe undersample) reachable via `git show 929ec3b:teams/mvox-dev/memory/bentham.md` if ever needed; load-bearing rules now live in the settled-patterns file where future-Bentham finds them on startup.

[LEARNED] **Scratchpad prune timing — prune at session END, not session START.** Session 12's work was still mid-flight at start of session 13 (branch parked at `ea1a2b1`, Layer 1 live execution pending). My startup prune dropped the session-12 narrative before that work fully landed. Correct cadence: keep current-arc entries in the scratchpad until the work they document is closed, then prune at shutdown. Patterns broad enough to deserve permanent capture go to `architecture-decisions.md` BEFORE pruning from the scratchpad — that's the steward's actual carry-forward path, not a `[PROCESSED]` block.

---

## Open at session-13 start (2026-05-22)

**Photo-rename status**: Layer 1 **merged as `82727ca`** 2026-05-22 13:33. Layer 2 (instance file-value migration) remains deferred under task #14.

**Carryforward YELLOWs**:
- **#19** — CSRF gate. Fires on first cookie-authed BFF POST/PUT/DELETE route. Demand explicit Origin check or token-pair CSRF.
- **#32** — Tailwind OKLCH. Relax assertion on next Tailwind upgrade. CHORE-scoped.
- **Task #14** — Layer 2 file-value plumbing. Open question: does Entu's POST-with-file-fields re-link to a pre-existing S3 object, or always require a fresh upload? Verify with `_probe_` against throwaway entity with a real file value before trusting any DELETE-then-POST migration on file properties.

**Active RED triggers (post-session-12)**:
- Any `await import(<pkg>)` purely as installed-check — use `node:fs` `existsSync(node_modules/<pkg>/package.json)` instead. Dynamic-import probes drag in runtime entry → forces vitest.config.ts coupling to production Vite config.
- Any DELETE-then-POST migration script touching file properties without round-tripping full file payload (md5/S3 key/content-type/filesize/filename). Empty-probe-today is NOT safe-to-defer for runtime-enumerating scripts.
- Any runtime-enumerating migration with incorrect dead-path code (the gap between dry-run and live-run is exactly when new values can land).
- `EntuProperty` type interface (`lib/entu-client.ts:32-38`) declares only `string`/`number`/`boolean`/`reference` — no file-shape. Any file-property mutation needs extended shape.

---

## Carry-forward review patterns (consolidated from sessions 2-12)

### Review-method patterns

- **Worktree-trust rule**: never read source via worktree state; always `git show <sha>:<path>`. Untracked WIP shadows commit content invisibly.
- **Worktree-create rule**: never `git checkout <sha> -- <paths>` for review on a non-target branch — materializes review files onto wrong branch index. `git show` only.
- **Test-flake hygiene**: build-output / static-config assertions belong in Vitest; only assertions requiring live SvelteKit server belong in Playwright.
- **Wire-shape novelty rule**: any callback hitting Entu with verb+path not already exercised live requires either (a) empirical probe in `docs/migration/findings/`, or (b) explicit YELLOW "unverified wire shape; needs probe before merge". Test-passing-only ≠ GREEN for new wire shapes.
- **Post-task report vs commit message body cross-check**: read diff → read commit message body → read task report; flag disagreement among the three even when only one is load-bearing (the code).
- **Spec-probe shape**: when test's intent is "is package X installed?", use `node:fs` filesystem probe against `node_modules/<pkg>/package.json`, NOT `await import('<pkg>')`. Filesystem probes stay node-only; vitest.config.ts stays decoupled.

### Migration script anti-patterns

- **Op-switch completeness**: every DiffOp kind needs explicit dispatch branch + "every op kind reaches a handler" assertion in integration spec.
- **Try-scope discipline**: bare-catch wrapping multi-statement try → over-scoped error absorption. Narrow to only the call whose failure mode the catch can recover.
- **Property records ≠ entities even when both expose `_id`**: prop-def `_id` → `DELETE /entity/{id}`; property-value `_id` → `DELETE /property/{id}`. Never share a single helper.
- **`verifyDeleteSafe` Probe 1 type-blindness is acceptable safety posture**: false positives block legit deletes (recoverable); false negatives destroy formula dependencies (unrecoverable). Conservative posture wins.
- **List-endpoint probes** used as "are there instances?" checks need `limit=500`, not 10.
- **Split-the-script-by-blast-radius** is the cheap unblock when one layer is RED. When bundled migration has clean Layer N + problematic Layer N+1, split into two scripts (one ships now, one deferred-with-task) > fix-in-place. Audit trail cleaner.
- **Empty-probe-today ≠ safe-to-defer**: any script whose manifest is built at runtime from live `listEntities` must have dead-code paths correct. Code-review the dead path AS IF it will fire.

### v4E RED triggers (canonical 7 + carve-outs)

1. Multi-hop formulas (anything beyond `propertyName.*.property` or `_parent`).
2. `type: reference` on formula property (silently coerces to string).
3. Formula projecting raw values across rights boundaries (aggregates OK; CONCAT of names leaks).
4. New BFF route in elevated mode without entry on enumerated elevated-ops list.
5. `_owner` / `_editor` / `_viewer` grant on org-subtree entity without active `member`.
6. Client code calling `https://entu.app` directly.
7. Flipping `_inheritrights: false` boundary without v4E schema change.

**Schema-mutation gate**: PR touching v4E entity types/properties/formulas/rights defaults must carry `Schema-Change: entu/research@<sha>` + `PO-Approved: ...` trailers. **Carve-out**: schema-alignment PRs (live data → already-landed schema) do NOT require trailers.

**Per-value `_sharing` warning DROPPED** per PO calibration. Don't add to checklist.

### Toolkit conventions (sessions 8)

- All lib functions take `EntuClient` (carries apiBase + db + jwt). `getJwt` is the only flat-args carve-out.
- `deletePropertyValue(client, propValueId)` → `/property/{id}`. `deleteEntity(client, entityId)` → `/entity/{id}` (covers prop-defs).
- `postProperties(client, entityId, properties: EntuProperty[])` — array shape.
- `replaceProperty(client, entityId, propType, currentValueIds, newValue)`: skip DELETE when `currentValueIds` empty; `{ ...newValue, type: propType }` shape.
- `findOrCreateByName(client, typeName, name, parentId?, propsIfCreating)`: name-keyed only. Member is keyed by `person.reference` + `_parent.reference` — inline check IS the idempotency gate.
- `writeResultArtifact(slug, payload, { at: Date })`: shared `at` between filename + `executedAt`. `scripts/migrations/seed-results/<slug>-<ISO-ts>.json`.

### Process-deviation calibration

- **Branch-discipline is load-bearing** for: (a) multi-author handoffs (branch IS unit of ownership transfer), (b) risky changes (PR review surface is the gate).
- **Branch-discipline is ceremony** for: single-author cosmetic refactors with pre-existing reviewer-spec'd YELLOW + clean minimum-diff implementation. When YELLOW-carryforward fix lands direct-to-main and is substantively clean, lean "accept-as-is + coach the path" over "reset + redo."

### Authorization-gate posture (session 9 codification)

Live-mutating data-manager ops require explicit "I authorize this run" SendMessage from team-lead. Bentham GREEN is NOT a substitute. Refuse to GREEN any live-execution path until the token lands.

### Pre-flight YELLOW close-before-gate (session 10 calibration)

For live-data-mutation scripts: when (a) fix is small AND (b) gain is a new drift class detected at pre-flight (not post-execution), fix-before-gate is cheap and PO-aligned. Carryforward-default underweights catching surprises BEFORE any irreversible op runs vs at halfway point.

### Author identity carryover

Pre-`db3c224` commits don't carry `Co-authored-by: Mihkel Putrinš` — accepted state, don't RED. Post-hook-install: missing trailer on new commit is YELLOW (mechanical) unless deliberate, then RED.

---

## Phase timeline anchors

- **Phase A** (renames + new types): PRs #26 + #27 merged 2026-05-19/20.
- **Phase B** (data backfill + instance migration): live-executed 2026-05-20.
- **Phase B.1** (instance cleanup of blocked deletes): merged.
- **Phase C** (structural: inventory_copy→copy+lending; participation→rsvp+attendance; affiliation/role retirement): closed 2026-05-21 (`f3529b7`, task #6 done).
- **Phase D** (rights flips + sharing alignment + DEPRECATED cleanup): closed 2026-05-21, fixup #64 GREEN.
- **Photo-rename pre-stage**: Layer 1 (prop-def rename) merged as `82727ca` 2026-05-22. Layer 2 (instance values) deferred to task #14.

(*MVOX:Bentham*)
