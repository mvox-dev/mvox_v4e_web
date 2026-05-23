---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-23 — Session 17 CLOSE: CHORE-B shipped on production

[CHECKPOINT] **Path C is live.** CHORE-B merged + deployed; 4 hotfixes landed in the same session (next= URL shape mirror, YELLOW-B.1 fold-in, layout-nav reactive to localStorage, pre-merge dev-scaffold drop + auth-UI hydration gate). My initial branch GREEN was correct on its scope but the integration cycle surfaced 4 follow-up issues that only PO live-test could find — appropriate split: my static review caught the YELLOW set; integration caught the dynamic cases.

[LEARNED] **YELLOW-B.1 closed by HOTFIX-2 (task #49).** PO live-test confirmed the `document.referrer` derivation was empty post-OAuth round-trip (as predicted); fix landed by encoding `provider` in the OAuth state payload — the alternative the file's own author comment had named. **Calibration**: when a static-review YELLOW flags a fix path that the file's own comment endorses + the fix is small, lean toward "fold-in pre-merge" rather than "post-merge follow-up issue." The cost of the post-merge fold-in (HOTFIX-2 commit + branch dispatch + re-review) exceeded what the pre-merge fold-in would have cost. Future Bentham: if a YELLOW's fix is sub-10-line + the implementer's own comments already point to it, prefer fold-in before merge, not after.

[LEARNED] **Hotfix sequencing observation: 4 hotfixes for a single feature merge is the upper bound of "acceptable iteration."** All four were post-merge issues only surfaceable by live-test (next= URL shape; provider memory; nav reactive to localStorage; hydration race for auth UI). The static-review gate did not catch them and was not designed to. The CHORE-C plan should explicitly carry a `PO-live-test → hotfix-cycle` step as expected, NOT as exception. Encode this in session-18 plan-review calibration: any Path C-style architectural rewrite plan must include a budgeted hotfix-cycle window between merge and "done."

[DEFERRED → Session 19 stewardship] **Three carry-forwards re-parked at session-18 close.** Session 18 was intro-only — no review dispatched, no RED/YELLOW verdicts. Team-lead's shutdown reason explicitly cites "per-commit-GREEN stewardship lift parked for session 19", confirming the lift remained unconsumed.
1. **Lift "every-commit-GREEN on a feature branch" to settled arch-decisions entry.** Sibling to the lint:fix-in-GREEN entry from session 16. CHORE-B is the canonical exemplar: 15 implementer commits, zero broken intermediates, bisect-clean across Josquin's two Path-2 re-sequencings. I offered to author this solo at session-18 startup; team-lead deferred.
2. **Author the entu-research case study (task #16) + Brilliant entry (task #17).** Now that Path C is live + the 4-hotfix-cycle is documented as expected-not-exception, the case study has real production evidence to cite. Defer the entu docs RFC (task #18) per its current `[DEFERRED]` status.
3. **YELLOW-50.1/51.1/A.3/A.4/B.1 are all closed.** Stewardship ledger remains clean entering session 19.

[GOTCHA] **B16 self-fix lesson stands.** The `PUBLIC_ENTU_API_URL` misattribution I caught + fixed in `93122ab` is the canonical example for "re-read source files BEFORE the steward commit." Bake this into my own startup ritual: when writing arch-decisions on the same branch as code changes, the workflow is `[read source] → [author doc] → [commit]`, not `[author doc from memory] → [commit] → [read source] → [self-fix]`. The self-fix worked but cost a commit + diluted the audit trail.

---

## 2026-05-23 — Session 17: CHORE-B GREEN (16 commits + B16 steward edit + self-fix)

[CHECKPOINT] **Branch `feat/chore-53b-rewrite` verdict: GREEN with 2 YELLOWs.** HEAD `93122ab` (post-B16 + post-self-fix). 17 commits total: 15 implementer commits (B1→B14, all signed by Josquin/Byrd, per-commit GREEN held throughout) + B16 architecture-decisions rewrite + minor self-fix of an env-var inaccuracy I introduced in B16. Verification: pnpm check 0 errors, 360/360 unit tests, lint clean. The 11 Playwright failures pre-flagged as CHORE-C scope (`tests/frontend-scaffolding.spec.ts` mocks the deleted BFF) — confirmed NOT branch-introduced regressions; they're the explicit "BFF mocks now reference deleted routes" gap.

[PATTERN] **Per-commit-GREEN discipline lifted to settled norm.** Across CHORE-B, Josquin surfaced at B11 + B12 that the plan's literal ordering would leave intermediate type-broken commits. Both times the team adopted "Path 2: every commit GREEN" via re-sequencing (B12 + B13 split into B13a wrapper-extend → B13b svelte-rewrite → B12 server-strip = 3 atomic GREEN commits). Net: 15 implementer commits, zero broken intermediates, bisect-clean. Spot-checked `pnpm check` on commits `998b414` (hooks no-op) + `5879292` (landing browser-direct) — both clean. **Encode for arch-decisions session 18**: lift "every commit on a feature branch must be independently GREEN (check + unit test + lint)" as a hard rule, sibling to the lint:fix-in-GREEN entry from session 16. Rationale: makes bisect viable + prevents the "transient broken-state hand-off lands in main on squash" failure mode.

[PATTERN] **`$app/navigation` vitest alias is right-layer + right-pattern.** Byrd's B13a introduced `vitest.config.ts` `resolve.alias: { '$app/navigation': './src/tests/mocks/app-navigation.ts' }` paired with `src/tests/mocks/app-navigation.ts` exporting `vi.fn()` for every `$app/navigation` export (`goto`, `invalidate`, `invalidateAll`, `preloadData`, `preloadCode`, `beforeNavigate`, `afterNavigate`, `onNavigate`, `pushState`, `replaceState`). Alternative considered + rejected: per-test `vi.mock('$app/navigation', ...)` would force every spec that imports a module that imports a module that imports `$app/navigation` to declare the mock. The config-level alias is the right layer (test infrastructure, not per-test setup) and the right pattern (mirror SvelteKit's actual export surface so future spec adoption is friction-free). The wrapper.ts `__mvox_test_goto` global is layered on top of the alias for assertion ergonomics (the alias provides a clean `vi.fn()`; the global lets specs pass a SPECIFIC fn and assert against it without round-tripping through the alias module). Both layers serve distinct purposes. **GREEN for the pattern.**

[PATTERN] **Browser-direct call shape — review enforcement triggers codified in arch-decisions.** B16 rewrite encodes 5 RED triggers under "Review enforcement (Bentham)":
1. New `+server.ts` under `src/routes/api/` proxying Entu data calls → RED (use the elevated-ops list with rationale instead).
2. Client-side JWT read/write outside `src/lib/auth/storage.ts` helpers → RED (single source of truth for key names + version sentinel).
3. Code path that writes `user`/`accounts` AFTER `setToken` → RED (token-version sequencing invariant from PR #56).
4. `apiRequest` consumer handling 401 itself instead of letting the wrapper interceptor fire → RED (central interception).
5. NEW client `fetch` to `entu.app` outside the documented call paths (`exchange.ts` + `build-oauth-init-url.ts` + landing's entity-list call) → discretionary YELLOW/RED case-by-case.

Lift the elevated-ops list to a separate decision so additions follow a clear gate. Done in B16.

[DEFERRED → Tallis] **YELLOW-B.1: callback's `setLastProvider` derivation from `document.referrer` is fragile.** `src/routes/auth/callback/+page.svelte:50-54` parses `document.referrer.match(/\/auth\/([^/?]+)/)` to pick the provider name. After the OAuth round-trip the user comes back through `api.entu.app` → callback URL; cross-origin Referrer-Policy is typically `strict-origin-when-cross-origin` or `no-referrer`, so `document.referrer` will frequently be empty or just an origin. Net effect: `mvox.last_provider` never gets written → re-auth UX regresses to provider picker. The fix is in the file's own author comment: encode `provider` in the OAuth `state` payload alongside `nonce` / `return_to` / `intent`. Single-line addition to `OAuthState` interface in `state.ts` + `setLastProvider(decoded.provider)` in callback. NOT a CHORE-B blocker — PO live-test will surface whether referrer survives in practice; routing to Tallis as a test gap + Byrd-scope fix follow-up. If PO live-test on the preview URL confirms remember-me lands cleanly on Smart-ID/Mobile-ID (where IdP doesn't strip referrer), keep as nice-to-have. If it fails, escalate.

[DEFERRED → CHORE-C] **YELLOW-B.2: Playwright `tests/frontend-scaffolding.spec.ts` mocks the deleted BFF.** 10 of the 11 failing Playwright specs mock `/api/organizations` + the orgs-list flow against the old BFF shape. Under Path C the data path is browser-direct; these specs need to be rewritten to either (a) stub `api.entu.app` via MSW per CHORE-C plan, or (b) be reduced to UI-shell smoke + a deferred "data flow lands when MSW lands" comment. The 11th failure (`tests/tailwind.spec.ts:22` OKLCH assertion) is a long-standing carry from session 12. Both are pre-flagged + appropriately scoped. NOT CHORE-B blockers.

[GOTCHA] **My own B16 commit had a doc-side env-var inaccuracy.** I wrote that `ENTU_API_BASE` is sourced from `PUBLIC_ENTU_API_URL` — it's actually a hardcoded literal in `src/lib/entu-config.ts` (`'https://api.entu.app/'`). The env var that does vary per deployment is `PUBLIC_ENTU_DB`, supplied at call sites. Self-caught in the review pass + fixed in `93122ab`. **Encode for stewardship discipline**: when authoring arch-decisions edits during a same-session branch review, re-read the source files referenced in the new doc text BEFORE the steward commit, not after. The doc claim should derive from the file, not from memory of what the file used to say.

[CHECKPOINT] **B16 self-review pass complete; review-of-my-own-doc cost ~1 self-fix commit (`93122ab`).** Net B16 surface: 2 new arch-decisions sections (`Data path — browser-direct to Entu` + `BFF elevated-ops list`) + the prior carve-out preserved in-place with SUPERSEDED header for audit trail + YELLOW-A.4 token-version comment in `storage.ts` + YELLOW-A.3 import-extension fixes on the 2 remaining `.ts` imports (`exchange.ts:1` + `entu/client.ts:11`) + YELLOW-50.1 + YELLOW-51.1 resolved (the wire-shape literal + parenthetical drift in the prior carve-out section is moot — the canonical wire shapes are stated in the new section).

---

## 2026-05-23 — Session 16: PR #56 GREEN (CHORE-A Path C foundation)

[CHECKPOINT] **PR #56 verdict: GREEN.** HEAD `db59557`, 9 commits, strict TDD ordering (RED→GREEN×4 + autofix). Spec compliance verified against `docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md` §6 + §9.1. New foundation libraries: `src/lib/auth/{storage,state}.ts` + `src/lib/api/wrapper.ts` skeleton + EntuClient moved out of `server/`. Defensive `!res.ok` throw extended to all 3 client methods (`get`/`search`/`setProperty`) — `search` + `setProperty` are bonus over the plan, which only specified `search`. Subsumes #52.

[PATTERN] **token_version cache-busting — version sentinel written only by setToken.** `setUser`/`setAccounts` deliberately don't bump `mvox.token_version`. The contract: at callback time, callers MUST sequence `setUser` + `setAccounts` BEFORE `setToken`. The `setToken` call is the gate that publishes the new auth state with the current version. If a future writer reverses this order across a version bump, get* will read stale data without triggering the wipe. Surfaced in PR #56 review (YELLOW-A.4 — proposed one-line invariant comment in storage.ts). Encode for CHORE-B review: any code path that writes user/accounts AFTER token is RED unless documented as intentional.

[PATTERN] **GREEN-cycle lint-divergence is real, not theoretical.** PR #56's `db59557` autofix commit exists because `pnpm test` GREEN'd before `pnpm lint:fix` ran. CHORE-A is the first GREEN cycle exercising the lint scaffolding from CHORE-48. Josquin's draft addition for `architecture-decisions.md`: "GREEN agents must run `pnpm lint:fix`, not just `pnpm test`." Endorsed lifting; pending team-lead concurrence. Encode for review of any future GREEN handoff: spec mock-shape or impl that passes tests but isn't linted = potential rework cycle.

[DEFERRED] **Two YELLOWs carry into CHORE-B (NOT blockers for #56 merge):**
- **YELLOW-A.3**: Import-extension drift. 6 new relative imports in CHORE-A are extensionless (`./storage`, `./state`, `./client`, `./wrapper`, `../auth/storage` ×2); 1 keeps `.ts` (`../entu-config.ts`). `rewriteRelativeImportExtensions: true` is on; convention per CHORE-32 GOTCHA + existing `+server.ts` files is to keep `.ts`. ~6 one-character edits, fold into CHORE-B.
- **YELLOW-A.4**: token-version invariant comment in `storage.ts` (see PATTERN above). Fold into CHORE-B.

[DEFERRED] **YELLOW-A.1 / YELLOW-A.2 — pre-existing Playwright failures**, verified pre-existing on `main` (Josquin checked against `3febec1`), NOT caused by CHORE-A. Routed to CHORE-C scope; the Tailwind one may need its own follow-up.

[DEFERRED] **Stewardship carryforward — YELLOW-50.1 + YELLOW-51.1** (architecture-decisions.md L204 wire-shape literal + parenthetical) confirmed still present on session-16 startup. Spec §References explicitly lists these for CHORE-B fold-in alongside the BFF user-rights default rewrite. Holding pending CHORE-B dispatch — no separate stewardship pass this session unless CHORE-B doesn't fold them.

---

## 2026-05-23 — Session 15: five clean reviews + two stewardship YELLOWs

[CHECKPOINT] **Session-15 review log (all GREEN, no RED dispatched):**
- **#34** (`d551a5d`): Tallis test-after-implementation pin of EntuClient.get() throws-on-!ok. YELLOW-32.2 close. GREEN clean.
- **#37** (`69f6ee6`): Comenius i18n landing — `m.landing_members_per_section({count})`. YELLOW-35.1 close. GREEN clean.
- **CHORE-48** (`b9b3499`): ESLint + Biome install-only scaffolding. Endorsed both Josquin judgment calls (assist disabled alongside linter; flat/recommended NOT spread). 79-file formatter sweep verified cosmetic-only on security-critical surface. YELLOW-37.1 + #25 folded.
- **Docs bundle #24+#29** (`dc3c8a5`): README replace + CONTRIBUTING extend. All 3 Tallis flags endorsed. SHA-anchor for CHORE-3 example endorsed (`7bf0d8f`).
- **CHORE-50** (`81589aa`): OAuth URL hotfix (wrong host + doubled state). Security-critical. CSRF gate verified intact end-to-end. All 3 Josquin calls endorsed (unified rebase; wrangler.json untouched; env-override mocks discipline).
- **CHORE-51** (`b52272f`): Sibling Entu auth URL fix (path-form → query-form, 2 call sites). `encodeURIComponent` defensive call endorsed as correctness-not-over-engineering. Same env-override discipline consistency reaffirmed.

[DEFERRED] **YELLOW-50.1 + YELLOW-51.1 — stewardship sweep on `architecture-decisions.md` L204 (carve-out section).** Combined updates needed in a single pass:
- Wire-shape line currently: `GET ${ENTU_API_BASE}{db}/auth` → should be `GET ${ENTU_API_BASE}auth?db=${encodeURIComponent(db)}`.
- Parenthetical literal "currently `https://entu.app/api/`" → should be `https://api.entu.app/`.
- Lesson and surrounding text remain correct; only the example value + URL template need updating.
- Same pattern as YELLOW-45.1 (which #46 closed via forward-pointer at L295). Consider whether to inline-update or add a forward-pointer for audit-trail fidelity. **Lean inline-update**: the carve-out section is the actively-consulted reference, not an audit-trail anchor (unlike L275-298 which IS anchored to the historical #20 incident).

[PATTERN] **"Production-side value is itself wrong" vs. "fixture-pins-default" distinction — codified across CHORE-50 + CHORE-51.** Session-10 `[PATTERN]` (architecture-decisions.md L275-298) protects fixtures from becoming tautologies when production-side defaults are STABLE. Distinct case: when the production-side default value is itself a BUG, the spec that pins that default MOVES with the fix (e.g., `entu-config.spec.ts:18` in CHORE-50; `callback-exchange-helper.spec.ts:67` in CHORE-51). Both cases preserve test INTENT; the SHAPE attested to changes. Env-override mocks (which pin override behavior, not default behavior) stay unchanged in both cases — they use the historical literal as a stable distinct-from-default fixture to make the override-flow assertion meaningful. Reaffirmed twice this session; future me should recognize this pattern without re-deriving it.

[PATTERN] **Defensive `encodeURIComponent` on URL-building primitives is correctness, not over-engineering.** CLAUDE.md "trust internal code" applies to logic flow + invariants enforced upstream — NOT to URL-construction primitives where the cost of safe-input encoding is zero (single primitive call) and the benefit is regression-proofing against future input drift (db renames, dev envs, test inputs, adversarial scenarios). Endorsed in CHORE-51 review without YELLOW. Over-engineering line: custom encoders, input-format validation upstream, type-narrowing — those would be premature. Calling the standard primitive at the call site is the minimum-correct shape.

[PATTERN] **Bundled-config exclusions audit method.** For PRs that exclude paths from a tool's scope (Biome `files.includes` negations; ESLint `ignores`; similar): verify each exclusion against `git ls-tree` of the actual path. Categorize each: (a) intentional bad-shape fixtures (formatting would corrupt — e.g., `schema-malformed.txt`), (b) frozen output artifacts (audit logs, reports), (c) sibling data dirs (the `.ts` source is included, the `.json` data is excluded), (d) generated artifacts (overwritten on regen), (e) standard exclude set (`node_modules`, `build`, `.svelte-kit`). If none of those categories fit, the exclusion deserves scrutiny. CHORE-48 review used this. Encode for future tool-config review.

[GOTCHA] **`assist.enabled: false` in biome.json freezes organizeImports state but the GREEN-pass output may already be organized.** When CHORE-48 ran `biome check --write` to produce the GREEN state, assist was likely briefly enabled (or organizeImports ran as part of the formatter sweep) — visible because the meta-spec's own imports got reordered RED→GREEN. Then assist was disabled for pnpm-lint stability. Future-CHORE turning assist back on may surface a one-time format-only commit (already-organized state may differ slightly from the new assist default). Pre-flagged so I don't RED that follow-up CHORE for unexpected churn — the churn would be expected.

---

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
