---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-22 — Session 13: #45 OAuth hardening review (branch `feat/oauth-hardening` final tip `5f2f9cb`)

[DECISION] **#45 final verdict: GREEN.** Bundle: CHORE-41.1 (CSRF binding) + CHORE-41.2 (Entu base URL unify) + YELLOW-45.1 (carve-out doc generalize) + YELLOW-45.2 (alias drop) — all folded in this session. Final bundle = 5 commits: `06acb25` (carve-out lift, mine) → `736f252` (RED) → `768ba44` (GREEN unify) → `ed85d1c` (45.1 doc, mine) → `5f2f9cb` (45.2 alias drop). All co-author trailers present. 399/399 unit tests stable across the 45.1/45.2 folds; `pnpm check` 0 errors.

[DECISION] **Bundle re-review verifications (post-45.1+45.2 fold-in):**
- `grep -rn "DEFAULT_BASE_URL" src/` returns 0 — alias fully gone.
- All 4 production import sites now consume `ENTU_API_BASE` from `src/lib/entu-config.ts`: `client.ts` (internal), `auth/+server.ts:3`, `auth/login/+page.server.ts:2`, `auth/exchange.ts:1` (client-side, was already direct).
- Spec files clean — zero leftover `DEFAULT_BASE_URL` refs in `.spec.ts`.
- Carve-out section reads correctly in final context — wire-shape line generalized; Cross-links updated.
- One stewardship follow-up surfaced (see GOTCHA below).

[GOTCHA] **`architecture-decisions.md` §"Test fixtures pin production defaults" still references `DEFAULT_BASE_URL`.** L277-291 use `DEFAULT_BASE_URL` as the canonical example of the production-vs-spec-fixture lesson — anchored to the historical `#20` v1 incident (`7e36c07`). After CHORE-45 the symbol no longer exists; a reader searching for `DEFAULT_BASE_URL` in src/ will conclude the doc is stale. **YELLOW-45.3 (stewardship-only)**: add a one-line update note to that section: "The constant has since been renamed to `ENTU_API_BASE` in `src/lib/entu-config.ts` (CHORE-45). The lesson generalizes to any production-side constant." Keep the historical example intact for audit-trail fidelity. NOT a blocker for this bundle's merge — the lesson is still correct, only the symbol name is dated. Logged for my own stewardship pass at end-of-session.

[PATTERN] **CSRF gate sequencing: read → 403-if-missing → delete-always → JWT-validate.** Impl at `src/routes/auth/cookie/+server.ts:15-21`. The sequence is load-bearing: (1) the `csrf_state` cookie's presence IS the CSRF attestation (it was set by `/auth/login` server-load when this user initiated the flow); (2) absence → 403 before any work happens; (3) delete-always (success/malformed/expired all clear the cookie) → single-use semantics enforced even on validation failure, preventing replay-after-shape-fix; (4) JWT validation runs on a cleaned slate. Encode for future review: any CSRF-gated endpoint that defers delete past validation is YELLOW (replay window) unless validation is single-shot atomic.

[PATTERN] **CSRF gate sequencing: read → 403-if-missing → delete-always → JWT-validate.** Impl at `src/routes/auth/cookie/+server.ts:15-21`. The sequence is load-bearing: (1) the `csrf_state` cookie's presence IS the CSRF attestation (it was set by `/auth/login` server-load when this user initiated the flow); (2) absence → 403 before any work happens; (3) delete-always (success/malformed/expired all clear the cookie) → single-use semantics enforced even on validation failure, preventing replay-after-shape-fix; (4) JWT validation runs on a cleaned slate. Encode for future review: any CSRF-gated endpoint that defers delete past validation is YELLOW (replay window) unless validation is single-shot atomic.

[PATTERN] **Delete responsibility moved cleanly callback → cookie endpoint.** Previously `+page.server.ts:18` deleted csrf_state on callback (single-use enforced by callback) → now `+server.ts:21` deletes it on cookie POST (single-use enforced by the consumer that actually needs the binding). Callback's read of csrf_state is a CSRF verify, not a CSRF binding consumer; the cookie endpoint is the actual binding gate. Callback's read-only access remains for the redirect-on-mismatch UX path. No spec broke because no callback spec asserted the delete side-effect — Tallis encoded delete-always semantics in the new cookie spec directly (test-gap 41.t1 implicit fix).

[PATTERN] **Co-located config outside `src/lib/server/` for cross-boundary constants.** `src/lib/entu-config.ts` is the new home for `ENTU_API_BASE`. Both server-side (`client.ts` via alias) and client-side (`exchange.ts`) import it. **Pattern**: when a constant must be shared across the server/client boundary AND has no logic AND isn't a type-only export, the home is `src/lib/<topic>-config.ts` (not under `src/lib/server/`, not in `src/lib/types.ts`). Reserve `src/lib/types.ts` for cross-boundary TYPES; reserve `src/lib/<topic>-config.ts` for cross-boundary VALUES. Distinct from Josquin's BFF-helper extraction zone (`src/lib/server/bff/`) — those are server-only.

[GOTCHA] **Arch-decisions carve-out wire-shape drift — my own `06acb25` doc now lags impl.** Carve-out section at architecture-decisions.md L204 says `GET https://api.entu.app/{db}/auth` (subdomain form, what `exchange.ts` used before this PR). After CHORE-41.2, the wire is `GET https://entu.app/api/{db}/auth` (path form). Semantic unchanged (carve-out is still "the OAuth session→JWT exchange call in `src/lib/auth/exchange.ts`"); URL literal in the doc is stale. YELLOW-45.1 for follow-up amendment — could amend within this same bundle if team-lead prefers one merge. **Stewardship calibration**: when authoring settled-pattern docs that cite specific wire shapes during an active hardening cycle, expect drift; prefer "the URL constructed from `ENTU_API_BASE` + `{db}/auth`" over hardcoded literal when the underlying constant is itself in flux.

[PATTERN] **`DEFAULT_BASE_URL` as alias-preserve: zero-churn but adds indirection.** `src/lib/server/entu/client.ts:3` now: `export const DEFAULT_BASE_URL = ENTU_API_BASE;`. Three importers still use the alias (`auth/+server.ts:3`, `login/+page.server.ts:2`, `client.ts:22` internal). Acceptable for the immediate PR — preserves backward compat. **YELLOW-45.2 follow-up**: migrate the importers to `ENTU_API_BASE` direct; drop the alias from `client.ts:3`. Single-PR scope, no behavior change. Encode for future review: alias-preserve indirection is OK as a single-PR breadcrumb, YELLOW as a settled state.

[CHECKPOINT] **Carry-forward YELLOWs for #45:**
- **45.1** — Amend `06acb25` carve-out section in `architecture-decisions.md` L204 (cite path-form URL or generalize to `${ENTU_API_BASE}{db}/auth`). ~2 lines. **Stewardship — I'll author when dispatched.**
- **45.2** — Migrate `DEFAULT_BASE_URL` consumers to `ENTU_API_BASE` direct; drop the alias. ~6 lines.

---

## 2026-05-22 — Session 13: #41 OAuth wiring review (branch `feat/oauth-wiring` tip `32e837f`)

[DECISION] **#41 verdict: GREEN with 3 follow-up YELLOWs + 1 test-gap.** Reviewed via `git show` on all 5 commits: `6a0e856` (RED, 45 tests across 6 files) → `972bf8f` (GREEN server: login/callback loads + cookie + logout) → `cbe4694` (ENTU_DB wrangler var) → `959c899` (GREEN client: exchange helper + callback page + login page) → `32e837f` (i18n: et/lv/uk for 5 new keys). 391/391 unit tests; 0 type errors; locale-key parity verified (all 4 locales: identical 19 keys). No v4E schema diff → no `Schema-Change`/`PO-Approved` trailers. Co-author trailer on all 5 commits.

[PATTERN] **Client-side Entu call is the carve-out, not the rule — IP-binding justifies it.** The "no client→Entu" canonical RED trigger has a documented exception: the OAuth session-token-to-JWT exchange step. Entu's session token is IP-bound (Finn research); CF Workers do not preserve browser IP on outbound. The server-side BFF cannot do this exchange. Carve-out scope: ONLY the GET `https://api.entu.app/{db}/auth` call inside `src/lib/auth/exchange.ts`. All other Entu calls still go through the BFF. Encode for future review: any client-side `fetch` to `entu.app` outside `src/lib/auth/exchange.ts` remains RED. Needs lifting to `architecture-decisions.md` if/when the BFF user-rights default section gets revisited.

[PATTERN] **SvelteKit `csrf.checkOrigin` default-on is the primary CSRF defense for `POST /auth/cookie`.** `svelte.config.js` does NOT override the default — SvelteKit enforces Origin-matching on POSTs at the framework level. The `csrf_state` cookie flow ONLY protects the callback step (binding the Entu provider redirect to the original /auth/login intent); after callback server-load consumes and deletes csrf_state, the subsequent client→`/auth/cookie` POST relies solely on the framework's checkOrigin. This is acceptable for MVP but means: **(a)** any future `svelte.config.js` change that touches `csrf.checkOrigin` requires Bentham RED-review, and **(b)** binding `/auth/cookie` to a still-valid `csrf_state` (YELLOW-41.1) is the architectural follow-up if we want defense-in-depth beyond Origin.

[GOTCHA] **Two Entu base URL conventions in flight — `api.entu.app` (subdomain) vs `entu.app/api/` (path).** `src/lib/server/entu/client.ts:1` `DEFAULT_BASE_URL = 'https://entu.app/api/'` (path form). `src/lib/auth/exchange.ts:1` `ENTU_BASE_URL = 'https://api.entu.app'` (subdomain form, hardcoded). `docs/migration/entu-schema-mutation-handbook.md:47-50` declares the path form **retired** in favor of subdomain — but `client.ts` still uses path form and tests pass, so Entu serves both. Pre-existing drift, NOT introduced by this PR. YELLOW-41.2 for unification (lift one canonical `ENTU_API_BASE` constant; standardize on the form documented as canonical). Note: `exchange.ts` hardcodes the URL with no env-var override hook (`process.env` is N/A in browser context); tests cope by mocking `fetch`.

[PATTERN] **`/auth/cookie` JWT validation: shape + exp only, NO signature verification.** Implementation at `src/routes/auth/cookie/+server.ts` decodes the JWT payload (base64-decode middle segment), checks `typeof exp === 'number'`, rejects if expired. NO signature verification — explicitly deferred until we have Entu's public key. **Threat-model reasoning**: the trust anchor IS the IP-bound Entu exchange step; if Entu issued the JWT, that's the attestation. An attacker who can call `/auth/cookie` with a forged JWT can only set their OWN JWT into the victim's browser (session fixation), not steal the victim's session. SvelteKit's `checkOrigin` blocks cross-origin form-POST; same-origin attack requires XSS (broader problem). Acceptable for MVP; YELLOW-41.3 to revisit signature verification when Entu publishes a JWKS endpoint or we settle on a verification library.

[PATTERN] **`src/lib/auth/` is Byrd's domain by extension.** Common-prompt §TDD-Workflow Byrd's enumerated write scope: `src/lib/components/`, `src/routes/**/*.svelte`, `src/lib/types.ts`. `src/lib/auth/exchange.ts` is client-side helper code — natural Byrd domain by analogy with `src/lib/server/` being Josquin's domain. **Calibration:** when an implementer ships in a directory not in the enumerated list but the directory's _content_ matches their scope (client-side helper for Byrd; server-only logic for Josquin), accept-and-codify rather than RED for scope violation. Worth a common-prompt clarification: "`src/lib/<client-only-feature>/`" is Byrd's by analogy with `src/lib/server/<feature>/` being Josquin's.

[CHECKPOINT] **Test-gap noted (Tallis):** No spec asserts that `csrf_state` cookie is DELETED after a successful callback (one-shot semantics). Implementation has `cookies.delete('csrf_state', { path: '/auth' })` at `+page.server.ts:18`, but no test pins the cookie-delete side-effect. One-line spec addition (test-gap, not a blocker).

[CHECKPOINT] **Carry-forward YELLOWs for #41:**
- **41.1** — Bind `POST /auth/cookie` to a still-valid `csrf_state` token (defense-in-depth beyond SvelteKit's checkOrigin). Requires callback server-load to NOT delete csrf_state until cookie POST succeeds, OR pass a one-shot challenge token in page data. ~30 lines, follow-up CHORE.
- **41.2** — Unify Entu base URL constants across `client.ts` + `exchange.ts`. Lift one canonical `ENTU_API_BASE` (subdomain form per handbook); standardize. ~10 lines.
- **41.3** — JWT signature verification on `/auth/cookie`. Defer until Entu publishes JWKS or we settle on a verification library. Follow-up CHORE with explicit security ask: validate Entu's signing posture first.

---

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
