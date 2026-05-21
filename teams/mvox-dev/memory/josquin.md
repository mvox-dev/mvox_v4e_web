# Josquin scratchpad

Personal notes. Only Josquin writes here.

---

## [PATTERN] 2026-05-21 — Test fixtures pin historical defaults; don't DRY them

When a beforeEach stubs an env var to match the production default literal, that's a **fixture**, not duplication. If you replace the literal with an import of the production constant, the assertion becomes tautological (`stubEnv(X, X)`) and silently loses its ability to catch drift if production shifts the default. Surfaced via Bentham's #20 v1 review: I had switched `client.spec.ts:7` from `'https://entu.app/api/'` literal to `DEFAULT_BASE_URL` — wrong move, reverted in v2.

**Rule:** DRY applies to production-to-production duplication. Test fixtures hardcode expected values *on purpose* — that's how they catch drift. If two test files share a fixture, factor it into a test helper (still a literal there), not into the production code under test.

**Also:** the SvelteKit `$lib` alias does NOT resolve in `vitest.config.ts` (separate from `vite.config.ts`, no sveltekit plugin loaded). Use relative paths (`'../../lib/...'`) for cross-tree imports in `src/routes/**` when the file is tested via vitest. Or teach vitest the alias if it ever becomes painful — for now relative is the smaller diff.

---

## [GOTCHA] 2026-05-21 — Entu API base URL: client.ts uses legacy `entu.app/api/` form, prompt says `api.entu.app/{db}/`

Surfaced during #20. My prompt (L107) declares the canonical Entu API base as `https://api.entu.app/{db}/` (subdomain form), but `src/lib/server/entu/client.ts` defaults to `'https://entu.app/api/'` (path form). The path form is also baked into the SvelteKit cookie name expectations and was apparently inherited from the CHORE-5 skeleton (#16/#17).

Out of scope for #20 (cosmetic DRY). Two possibilities:
1. Legacy form works (path-based routing on the same MongoDB+S3 backend) — likely, given CHORE-5 GREEN landed and the test/probe suite exercises the live API via this path elsewhere. Worth confirming the next time a BFF route actually calls Entu for real (today the client lives but has no live caller).
2. Legacy form is broken — would be caught the first time we make a real Entu call. Risk: silent failure path or wrong-host CORS.

**Action when next BFF route lands:** before merging, swap `DEFAULT_BASE_URL` to `'https://api.entu.app/'` and adjust `entityUrl` / `search` URL construction (the current code does `${baseUrl}${db}/entity/...` which works for both forms since baseUrl already has the trailing slash and db slots in next). Then probe live to confirm. May warrant its own chore issue — flag to team-lead when the first real-call route is in flight.

---

## [LEARNED] 2026-05-20 — Squash-merge flow on this team

Each PR landed on main via the same local squash-merge ritual (no PRs opened on GitHub; all feature branches stayed local). Steps that became muscle memory:

1. **Stash unstaged scratchpads** (Bentham's and/or Pérotin's) before `git checkout main` — they routinely leave their `teams/mvox-dev/memory/*.md` dirty in the worktree between cycles. `git stash push -- <paths>`. Pop after push.
2. **`git merge --squash <branch>` then commit with the team-lead-supplied message** verbatim (including the `(*MVOX:<author>*)` trailer, which is sometimes Tallis for test-only PRs not me). Co-author trailer auto-added by `prepare-commit-msg` hook.
3. **`git branch -D` for local cleanup** — `-d` always fails because squash-merge doesn't update the merge graph. Expected.
4. **`git push origin --delete <branch>` always errors** with "remote ref does not exist" because nobody pushed the feature branch — all GREEN/RED commits stayed local until squash. This is normal, not a failure mode.

The 7 squash-merges I did across session 8 (3-2-2-3 grouping was wrong — actually 9 PRs: #44, #52+#54 bundle, #56, A, B, C, D, E, #58) all followed this exact pattern. If future me sees a remote feature branch actually exists, that's a sign someone pushed it (e.g., for a non-local review surface) and the cleanup step might do something — verify before the delete.

## [LEARNED] 2026-05-20 — Toolkit lib union-arg discriminator pattern

When two RED specs pin the same positional arg to different types (Tallis: `listInstancesByType(client, type, props, 50)` expects `limit` at position 3 as `number`; Pérotin: same position needs `Record<string,string>` for extraQuery), don't param-swap — union-type the arg and discriminate at runtime with `typeof === 'number'`. Position 4 becomes overflow for "I want both" cases (limit at 3, extraQuery at 4). The lib at `scripts/migrations/lib/entu-client.ts` has the production pattern; #58 added direct lib-side coverage so a regression in the discriminator surfaces directly rather than through the Pérotin-side spec.

The principle is broader: when an existing GREEN spec pins a positional contract, prefer **type-level discrimination** over rearranging args. Adding a new branch to a union is non-breaking; reordering is.

---

## [GOTCHA] 2026-05-19 — `pnpm dlx sv create` tsconfig has JSON-incompatible comments
The minimal scaffold's `tsconfig.json` contains `//` line comments after the `compilerOptions` block. They are valid for TypeScript's JSONC parser but crash `JSON.parse`. Any AC test that does `JSON.parse(readFileSync('tsconfig.json'))` will fail until comments are stripped. Stripping is safe — TypeScript itself doesn't need them. Worth knowing for future scaffolds (sv may also drop similar comments in `package.json` derivatives).

## [GOTCHA] 2026-05-19 — Playwright `fullyParallel: true` + execSync('pnpm build') from one test = race
If one Playwright test invokes `pnpm build` while another navigates the preview server, vite rewrites `.svelte-kit/output/` with new content-hashed filenames mid-flight. The preview server's already-served `index.html` references the old chunks → `ENOENT` on the file read → ECONNRESET on the next HTTP call. Pattern: keep "did the build produce X?" checks in vitest (no live server); keep "does the running app behave correctly?" checks in Playwright.

## [DECISION] 2026-05-19 — Hook install pattern (`.githooks/` + `scripts/install-hooks.sh`)
We picked the "versioned hooks dir + pnpm prepare script" approach for the co-author trailer hook. Files of record:
- `.githooks/prepare-commit-msg` — uses `git interpret-trailers --if-exists doNothing --in-place` (idempotent, normalises trailer block).
- `scripts/install-hooks.sh` — copies + chmods, no-ops if `.git/hooks` is absent (tarball/CI scenarios).
- `package.json` `"prepare"` chains `scripts/install-hooks.sh && (svelte-kit sync || echo '')` — pnpm runs this on every fresh `pnpm install`.

If we add more hooks later (`pre-commit` lint, `commit-msg` format), drop them in `.githooks/` and the install script picks them up for free.

## [PATTERN] 2026-05-19 — Branch hygiene during squash-merge with concurrent worktree edits
When a teammate's scratchpad write is unstaged in the working tree at merge time, `git stash push -- <file>` before the squash, then `git stash pop` after. Keeps the squash diff clean without dropping anyone's WIP.

## [DECISION] 2026-05-19 — `wrangler.json` shape for CHORE-1
Minimal Pages-targeted config that we landed in `feat(#1)`:
- `name: "multivox"`
- `compatibility_date: "2026-05-18"`
- `compatibility_flags: ["nodejs_als"]` (required by adapter-cloudflare for AsyncLocalStorage; per SvelteKit Cloudflare adapter docs)
- `pages_build_output_dir: ".svelte-kit/cloudflare"`
- NO bindings (no D1/R2/KV/Durable Objects).

If/when we need bindings for a later story (e.g., a KV cache for Entu responses), add them here — and remember to revisit Bentham's review checklist for the "no extra bindings" AC.

## [LEARNED] 2026-05-20 — Phase A shipped (live execution successful, exit 0)

Phase A executed against polyphony at 2026-05-20T03:46:18Z. **9 entity types created + 79 properties added + 0 failures.** Report committed on main as `a127729`. PR #26 (impl, merged at `e3ceb28`) + PR #27 (Bentham's partial-failure-recovery bypass, merged at `0400cba`). The session-6 [CHECKPOINT] issues (fetchDbState filter, v4E field-name mismatch, missing dry-run markdown sections, ESM `__dirname`) are all resolved in code — no future-session value in keeping the list of bugs; this entry captures the durable patterns instead.

### Patterns worth keeping (for Phases B/C/D)

**Probe-then-implement when the spec disagrees with reality.** The first live dry-run revealed three spec-vs-real-db mismatches that unit tests (mocked fetch + 2-type fixture) could not catch. Always run at least one live dry-run before claiming Phase X impl is "done" — and structure the dry-run report so it's directly diff-able against the divergence audit. The 22:18 → 22:37 dry-run delta caught the §4.2-vs-actual gap before any write hit the db.

**v4E → Entu field name translation lives in its own module.** `scripts/migrations/lib/v4e-translator.ts` maps blurb→label, sharing→_sharing, inheritsRights→_inheritrights, required→mandatory, oauth→string, ref:true→reference. Phase B/C/D scripts should reuse it (or its successor) rather than re-derive these mappings. Spec field naming is **not** API field naming.

**Phase scope filter as a hard whitelist.** `scripts/migrations/lib/phase-a-scope.ts` is the source of truth for what Phase A touches — encoded as `PHASE_A_PROPERTY_ADDITIONS: Record<string, Set<string>>` (35 entries from divergence §4.2) + `PHASE_A_NEW_TYPES: Set<string>` (9 entries from §4.1) with `isInPhaseAScope` / `isPhaseANewType` helpers. Pattern for Phase B/C/D: same shape, derived from the divergence audit's per-phase tables. Without it, an additive diff over-creates (Phase B renames get spuriously added as Phase A new properties).

**Partial-failure recovery via PHASE_X_NEW_TYPES bypass.** Bentham caught this YELLOW in PR #26: if `createEntity(<§4.1 type>)` succeeds but the inline-property loop crashes mid-iteration, a naive re-run hits the scope filter and silently skips the missing inline props. Bypass = `isPhaseANewType(parent) || isInPhaseAScope(parent, prop)`. Phase B/C/D scripts that batch inline operations should ship the same recovery path before the first live run.

**Squash-merge while peers are editing scratchpads.** `git stash push -- teams/mvox-dev/memory/*.md` before `git merge --squash`, then `git stash pop` after. Keeps the squash diff clean and doesn't drop in-flight WIP from other agents. Used twice this session.

### Polyphony db layout gotcha (still relevant for Phases B/C/D)

App entity types in polyphony's Entu db are **root-level** (no `_parent` set on the type-definition entity), NOT children of the polyphony db entity `69bcfd8e9c031ab8e6ce807a`. Only the 6 system meta-types (database/entity/menu/plugin/property + the original `person`) are parented under it. Filter to enumerate entity types: `_type.reference=69bcfd8e9c031ab8e6ce8034` with NO `_parent` constraint. Documented in `docs/migration/v4e-divergence-2026-05-19.md` §1 and now in the handbook's lesson-learned column.

### Three formula touch-saves pending for Phase B prep

After Phase A, these three properties exist with formulas but their existing instances haven't been touch-saved to materialize the computed values:

1. `lending.name` — formula `member.*.name copy.*.name ' — ' CONCAT_WS` — 0 existing instances; touch-save is a no-op until lending instances start being created.
2. `organization.member_count_per_section` — formula `SUM(_child section.member_count)` — 6 existing org instances; inner `section.member_count` formula itself is Phase B work, so values will be stale until Phase B fixes both layers.
3. `edition.work` — formula `_parent` — unblocks `program_item.name` chain in Phase B.

Touch-save = POST any field on the instance to re-trigger formula evaluation (see handbook §5.1). Phase B's first task should batch these.

### Per-entity IDs from the live execution

Full ID listing in `scripts/migrations/reports/2026-05-19-phase-a-2026-05-20T03-46-18-833Z.{md,json}`. Top-level type IDs to bookmark for Phase B referencing:
- voice `6a0d2e8090c8df7a1cc7dd6a`
- library `6a0d2e8090c8df7a1cc7dd9d`
- copy `6a0d2e8190c8df7a1cc7ddb0`
- lending `6a0d2e8190c8df7a1cc7dde8`
- invitation `6a0d2e8290c8df7a1cc7de3e`
- application `6a0d2e8390c8df7a1cc7de81`
- event_series `6a0d2e8490c8df7a1cc7deb1`
- rsvp `6a0d2e8590c8df7a1cc7df1b`
- attendance `6a0d2e8690c8df7a1cc7df4b`

(*MVOX:Josquin*)
