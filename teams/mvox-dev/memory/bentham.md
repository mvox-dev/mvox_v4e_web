---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-22 — Session 13: #35 Frontend scaffolding review (branch tip `98eaa33`)

[DECISION] **#35 verdict: GREEN with 4 follow-up YELLOWs.** Reviewed at `git show 98eaa33:<path>`. 25 RED tests (`c727f2f`) → 7 Vitest GREEN + 17 Playwright GREEN + 1 documented `.skip()` (`e77c280`, references CHORE-36). Security-critical: no client→Entu call, no server import in client, no XSS surface (Svelte auto-escape everywhere; no `{@html}`), JWT not leaked in nav (decorative bullet only). Svelte 5 runes throughout; no legacy syntax. YELLOWs: 35.1 hardcoded `members/section` in `+page.svelte:95`; 35.2 `OrgEntity` declared in 3 files (lift to `src/lib/types.ts`); 35.3 `$app/stores` legacy form on the first such import in the codebase; 35.4 session derivation fragility (architectural — lift to `+layout.server.ts`).

[PATTERN] **Session derivation in `+layout.svelte` from `$page.data?.session` is fragile — should live in `+layout.server.ts`.** When session-aware nav reads from `$page.data?.session`, it only sees session on routes whose `+page.server.ts` returns `session`. Today only `/` provides it → `/auth/login` shows "Sign in" even when signed-in (wrong nav state). The architectural fix is to populate `session` in `src/routes/+layout.server.ts` so every route inherits it. **RED trigger for the next-but-one authenticated route**: if a route requires auth but doesn't supply `{ session }` in its own page.server.ts AND `+layout.server.ts` doesn't yet exist, the nav is broken. YELLOW today (only `/auth/login` affected); turns RED when the second authenticated route lands. Encode for review of any future `+page.server.ts` returning auth-gated data: ensure session lives in `+layout.server.ts` before merging that route.

[PATTERN] **`$app/stores` is legacy on SvelteKit 2 + Svelte 5; `$app/state` is the forward-looking convention.** `import { page } from '$app/stores'` works (it's the runtime-store API, not a runes violation) but `import { page } from '$app/state'` is the rune-compatible equivalent in SvelteKit 2. Common-prompt's "Runes ONLY" rule doesn't explicitly call this out — but on the first `$app/*` import in mvox setting the convention, prefer `$app/state`. YELLOW for legacy usage; not RED unless an entire feature ships with stale legacy patterns.

[PATTERN] **Transient duplication during CSR-shim phases is acceptable.** When an architectural decision creates a temporary CSR-over-SSR accommodation (e.g., #35's `+page.svelte` `$effect` re-fetches what `+page.server.ts` already fetched), the duplication between server-load and client-effect is deliberate, time-bounded, and disappears at the CHORE that completes the migration (here: CHORE-36). Don't YELLOW transient duplication tied to a documented future CHORE — only YELLOW persistent duplication (types, helpers, route-shared logic). Distinguishing test: "would un-duplicating this require reverting the CSR shim?" If yes → transient, accept. If no → factor.

[PATTERN] **Type-as-source-of-truth lives in `src/lib/types.ts`.** When a payload-shape type (e.g., `OrgEntity`) is declared in N>1 files, the canonical home is `src/lib/types.ts` (Byrd's scope per common-prompt §TDD-Workflow). When N=3 and each declaration is byte-identical, YELLOW for lift-to-types. Pair with the BFF helper-extraction YELLOWs — same shape, different scope (types for shared shapes; `src/lib/server/bff/` for shared logic).

[GOTCHA] **Hardcoded English can slip past i18n review when it's a suffix to a data value.** `#35` had `{org.member_count_per_section} members/section` — the English `members/section` is a suffix to a templated number, which doesn't visually look like a "string" the way `<h1>Sign in</h1>` does. Comenius's review pass missed it because the line opens with `{...}`. **For future i18n review:** scan for English words anywhere on a line containing `{...}`, not just lines that are pure text. Canonical i18n YELLOW (Comenius is the natural owner), not RED.

---

## 2026-05-22 — Session 13: #32 BFF MVP review (commit `49ee037`, merged as `8fd3ed0`)

[DECISION] **#32 verdict: GREEN with 2 follow-up YELLOWs.** 27/27 RED tests at `9087a1f` mapped exactly to AC §§5.1+5.2; impl at `49ee037` satisfies them. 328/328 tests pass; `pnpm check` 0. TDD ordering monotonic. Schema-mutation trailers present (depends on `82727ca` Layer 1 + `entu/research@f52adc4`). Security-critical surface (two new `+server.ts` + `client.ts` throw addition) reviewed line-by-line.

[PATTERN] **Consistent JSON-envelope errors > SvelteKit `throw error()`.** Design doc §5.2 prescribed `throw error(404, 'not_found')` (returns SvelteKit's HTML/JSON-mixed page). Impl chose `return json({ error: 'not_found' }, { status: 404 })` consistently across all error paths. This is a strict improvement: frontend consumers get a predictable JSON shape regardless of error code; tests can pin `body.error === 'auth_required'` etc. Carry forward as the preferred BFF error shape: **all BFF error responses use `json({ error: '<code>' }, { status })`, not `throw error(...)`** — unless we explicitly want SvelteKit's page-level error UX (which we don't for API routes).

[PATTERN] **Library wire-shape change pinned indirectly via consumer test → YELLOW follow-up for direct lib test.** `EntuClient.get` got `if (!res.ok) throw ...` added at `49ee037`. The sections route's `client.get(orgId).catch(() => null)` is the consumer that depends on it. Sections spec mocks `fetch` to return status 403/404 and asserts route returns 404 — so the throw IS exercised end-to-end. But `client.spec.ts` has no direct test pinning `client.get(badId)` against a 403/404 mock. Per PR #58/YELLOW-14 calibration: consumer-side indirect test ≠ direct lib-side test, but IS GREEN-eligible with direct test as follow-up YELLOW. Carry forward as YELLOW-32.2 (GH #34); ~10 lines for Tallis.

[PATTERN] **Helper-duplication threshold: 4 helpers × 2 routes is past "three similar lines."** CLAUDE.md says "three similar lines is better than a premature abstraction." That bar applies to a single helper. Once you have 4 byte-identical helpers (`parseLimit`, `parseSkip`, `extractStringProp`, `extractNumberProp`) duplicated across 2 routes, the abstraction has earned its keep — but only when route #3 lands (don't pay now for a binary "is there route #3 yet" condition). Right factor-out: `src/lib/server/bff/{pagination,props}.ts`. YELLOW follow-up (GH #33). **Encode for future BFF route reviews: when a 3rd `+server.ts` lands with the same shape, YELLOW becomes RED.**

[GOTCHA] **`rewriteRelativeImportExtensions: true` + `.ts` imports.** mvox's tsconfig.json enables `rewriteRelativeImportExtensions`, so relative imports keep the `.ts` extension. Existing convention confirmed via `src/routes/auth/+server.ts:3`. Watch for: any new file using extensionless relative imports (`from '../../lib/server/entu/client'`) is inconsistent even though it works — cosmetic YELLOW for consistency.

---

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
