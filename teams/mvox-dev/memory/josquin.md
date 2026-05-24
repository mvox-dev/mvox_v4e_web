# Josquin scratchpad

Personal notes. Only Josquin writes here.

---

## [CHECKPOINT] 2026-05-24 session 22 — Two squashes + trailer-collision arch entry + twin surface-and-stops on CHORE-66

Session shipped two merges + one doc-only commit:
- `9637eee` — CHORE-62 + CHORE-63 squash (MvoxNav i18n wiring + textSnippet fix). PO trailer dropped here because dispatch template had a malformed `Co-authored-by: Comenius, Tallis, Byrd, Bentham (review)` line that short-circuited the hook.
- `7d078f7` — architecture-decisions entry codifying "dispatch-message `Co-authored-by:` trailers short-circuit prepare-commit-msg hook." Self-dogfooded — kept my OWN commit body free of `Co-authored-by:` so the hook would append the PO trailer cleanly. Verified.
- `9266e2e` — CHORE-66 squash (navbar auth wiring: userStore + OrgPicker + +layout integration). 15 files / +852 / -33. Trailer hook ran clean per the new rule. GH #66 auto-closed at 13:11:38Z.

### Durables worth keeping

[GOTCHA] **`git interpret-trailers --if-exists doNothing` dedupes on KEY, not on full value.** If a commit body already carries `Co-authored-by: <anything>`, the prepare-commit-msg hook's `interpret-trailers` call silently DOESN'T append the PO trailer. Failure mode is silent — no warning surfaces at commit time; you only spot it by running `git log -1 --format='%(trailers)'` after push and noticing the PO line is missing. Codified in arch-decisions `7d078f7`. Three permissible alternatives in dispatch templates: `Contributors:`, `Reviewed-by:`, `Helped-by:`. Body prose attribution is fine. The genuine multi-author co-authorship form (`Co-authored-by: Name <email>` one per line, properly formatted) survives the hook because the hook dedupes on FULL VALUE — so distinct properly-formatted lines all coexist. Malformed group-form (`Co-authored-by: A, B, C (review)`) is the trap.

[PATTERN] **Surface-and-stop pays even more when the plan is wrong on TWO axes at once.** CHORE-66 Task 1 had two stacked plan errors:
1. URL form (plan: `https://{db}.entu.app/api/...`; production: `https://api.entu.app/{db}/...`) — caught at 08:38 via DNS probe, before commit
2. Data model (plan: `person.members[]` inline; reality: separate `member` entity with `person.reference` back to person) — caught at 10:42 via authenticated probe

I sent two separate surface-and-stops rather than batching. Team-lead processed them sequentially: Path 1 approved + plan fixed at `ed7f7b8`; data-model finding incorporated into Task 3 plan code at `3d0ef30`. The 10:46 PO-multi-org probe addendum surfaced a third corner (founder-only orgs don't have member rows) which got logged as out-of-scope in the final commit body and a future-CHORE pointer. **Total cost: ~30 min round-trip × 2; total saved: would have been ~hours of Task 3 rewrite mid-stream when Byrd hit the empty `members[]` field.**

The dispatch said "if MORE schema differences, surface-and-stop again — we'll adjust before locking the contract." That's a pre-authorization to KEEP surfacing, not a budget. Use it. Two surface-and-stops in one task is cheaper than one half-corrected commit.

[GOTCHA] **Pérotin's "person + member ID" seed-table sent member IDs first, person IDs second** — for Margus: `6a12036e4ff8277cd4306b9a` (member) vs `6a12036d4ff8277cd4306b93` (person). Reading the plan literally ("probe `<PERSON_ID>`"), I would have hit the member entity and seen no name/members and possibly misdiagnosed as a rights filter or a missing-prop. The actual person entity sits one step "back" via `member.person.reference`. Future seed-target deliveries from Pérotin should label which ID is which OR put the person ID first by convention; flagged to team-lead at session end so the convention can be pinned.

[CONTRACT] **API_KEY → JWT exchange wire shape (verified 2026-05-24)**: `GET https://api.entu.app/auth?db=<db>` with `Authorization: Bearer <API_KEY>` returns `{accounts: [{...}], user: {...}, token: <jwt>}`. The JWT is IP-bound (`aud=<callerIP>`), 48h lifetime, no refresh. Per `project_entu_jwt_ip_bound` + `project_entu_api_key_mechanics`. Crucially, the API key DOES NOT work as a Bearer directly against data API — that returns 401 `jwt malformed`. The exchange step is mandatory. Same wire shape applies whether the source bearer is an API key OR an OAuth session token (per session-15 [CONTRACT]). Stash a JWT after exchange and reuse for the rest of the session.

[CONTRACT] **v4E person-with-orgs query shape (verified 2026-05-24 on polyphony)**:
- **Person entity** (display name): `GET /entity/{personId}?props=name` → envelope `{entity: {_id, name: [{string}]}}`. NOTE the `.entity` wrapper — easy to miss; unwrap to access fields.
- **Person's org memberships**: `GET /entity?_type.string=member&person.reference={personId}&props=_parent` → flat `{count, limit, skip, entities: [...]}`. Each member's `_parent` is multi-valued with both org AND section parents inline, distinguishable by `entity_type === 'organization' | 'section'`. `_parent[].string` is the parent's name denormalized — **no per-org name fetch needed**. Member entity is the join table; person does NOT inline `members[]`.
- **JWT claims shape**: `{accounts: {<dbName>: '<personId>'}, iat, exp, aud}`. NO `sub` claim. Extract person ID via `claims.accounts[<dbName>]`.
- **Founder-only edge case**: a user who is `_owner` of an organization but has no `member` row WILL NOT appear in the member-search. PO confirmed this empirically (owns 4 orgs, 0 members). If a future feature needs to surface founder-as-affiliation, union with `?_type.string=organization&_owner.reference={personId}`.

Documented in `src/lib/auth/types.ts` (commit `e12522a`, squashed into `9266e2e`). The `EntuPersonResponse` + `EntuMemberSearchResponse` + `EntuJwtClaims` types carry the contract in TSDoc on the type definitions themselves — Byrd's Task 3 mock setup pulled directly from those examples.

[PATTERN] **Probe-then-implement, even when the plan is detailed.** Plan had specific URL + JSON shape + property names. Reality differed on URL form, envelope shape, member-direction. ~3 curl probes (5 minutes) caught all of it before any consumer code wrote against the wrong contract. The cost of probing is trivial compared to the cost of "Task 3 was tested against a mock matching the plan, all greens; production hits empty results because the wire shape doesn't exist." Especially for FIRST consumer of a wire surface — every subsequent consumer can trust the now-tested contract, but the first probes.

[PATTERN] **Self-dogfooded the trailer rule.** After codifying "no `Co-authored-by:` in dispatch templates" in arch-decisions, my OWN doc commit body (`7d078f7`) and ALL subsequent commits this session kept the body free of `Co-authored-by:`. PO trailer appeared on every one. Pattern: when you author a rule, the FIRST commits AFTER are the test bed — verify the rule with your own discipline before propagating it as a team norm. The new feedback memory [No urgency language] applies here too: codify quietly + dogfood, don't announce.

### Open items at session-22 close

- **YELLOW-66.2** — `ENTU_DB` hardcoded in `userStore.ts` (defaults to `'polyphony'`). Needs env-lift via `PUBLIC_ENTU_DB` from `$env/static/public` before prod. Palestrina will file as a follow-up CHORE post-merge.
- **Founder-as-org-affiliation corner** (CHORE-66 out-of-scope) — surface someday if PO or org founders complain about empty pickers despite owning orgs. Not blocking.
- **CHORE-67** — `/library` data wiring (the natural next step now that auth/org context is in place). Plan stub TBD.
- **Role-derived chip text** (CONDUCTOR/ADMIN/MEMBER per selected org's rights) — out-of-scope CHORE-66, deferred. Will need a `member._owner`/`_editor` + section-leader + conductor introspection — pattern: `_rights[]` array on the org entity for the user. Worth a Finn-research pass before implementing.
- **0-org onboarding flow** — out-of-scope CHORE-66. UX question first.

(*MVOX:Josquin*)

---

## [LEARNED] 2026-05-24 session 21 — CF Pages custom-domain binding has two-stage `_data` state machine

Task #75 (mvox.eu DNS rebind). After creating the apex CNAME `mvox.eu` → `multivox.pages.dev`, the Pages domains API returns THREE status fields, not one:

```json
{ "name": "mvox.eu", "status": "pending",
  "verification_data": { "status": "active" },
  "validation_data":   { "status": "pending", "method": "http" } }
```

- `verification_data.status` flips to `active` once the CNAME resolves to a project the account owns (~69s post-CNAME for me; expected window ~30-120s).
- `validation_data.status` is a SEPARATE background check — HTTP-method TLS/SSL cert issuance + ACME challenge. Runs AFTER verification clears. Top-level `status` only becomes `active` when BOTH inner statuses are `active`.
- **Serving (HTTP 200 from `mvox.eu/library`) starts the moment `verification_data` flips, NOT when top-level `status` does.** Verified 200s with `x-sveltekit-page: true` while top-level `status` was still `pending` and `validation_data.status` was still `pending`.

**Implication for completion criteria**: don't gate task-completion on top-level `status: active`. Gate on either (a) `verification_data.status: active` + curl returns 200, or (b) endpoint smoke alone. The brief's "binding active within ~90s" is too coarse — the right read is "verification active + endpoint serves," which is faster and is the actual user-visible thing.

For future CF Pages binding work (custom domains, federation hosts, etc.), poll BOTH nested status fields independently and report the transition timestamps separately. The top-level summary status will lag and may look "broken" while everything actually works.

(*MVOX:Josquin*)

---

## [GOTCHA] 2026-05-24 session 21 — DNS state can drift between dispatch + execution; always probe before mutating

Task #75 brief expected 2× apex A + 2× apex AAAA records (per Task #74's snapshot). Actual live state when I probed: ONE apex A only (`185.31.240.240`, zone.eu parking IP) — the 4 IPv4/IPv6 records from the brief were gone. Someone (PO, CF auto-prune, registrar) had cleaned them up in the gap between Task #74 surfacing the issue and Task #75 executing.

If I had blindly executed Step 3 with the brief's record IDs, the DELETEs would have 404'd silently and Step 4's CNAME create would have COLLIDED with the still-present `185.31.240.240` A record at the apex (CF rejects A + CNAME co-existing for the same name). The whole rebind would have failed and looked like a token-scope problem again.

**Always re-probe the actual list BEFORE forming the mutation plan**, even when the dispatching agent gave you specific IDs/values. Then surface-the-diff to team-lead before mutating ("brief said X, actual is Y, plan is now Z") — the round-trip cost is ~30s of inbox latency, the cost of guessing wrong on a DNS apex is hours of debugging plus a stale-cache window.

This generalizes beyond DNS — any time the dispatch brief specifies entity IDs / record IDs / property values captured at a prior point, treat them as REFERENCE not GOSPEL. The probe-fresh-then-execute discipline is the same as my session 14 [PATTERN] on diagnostics: stop-and-surface beats blind retry.

(*MVOX:Josquin*)

---

## [PATTERN] 2026-05-23 session 17 — Surface-and-stop when type-check would RED, propose Path 2 split

CHORE-B11 + B12 both hit a transient "production code would type-check-RED if I land the planned commit alone" scenario. The plan ordering was opportunistic, not load-bearing — it assumed downstream commits would close the type gap. Team-lead's dispatch in BOTH cases said "if check warns, surface and stop." I did, and both times team-lead chose **Path 2**: split the commit so the load-bearing change lands alone (keeping branch GREEN), defer the cosmetic type-cleanup to a later commit that has zero consumers left.

**Template for the surface-and-stop message** (worked twice cleanly):

1. Quote the concrete error output verbatim (file:line + message).
2. Diff-vs-other-cases — explain WHY this RED happened when prior similar work didn't. (For B12: `import type { PageData } from './$types'` vs `$props<{ data: {...} }>()` — the former cross-validates, the latter doesn't.)
3. Enumerate options as **Path 1 / Path 2 / Path 3** with explicit tradeoffs (transient broken state vs cross-agent coupling vs in-band shim).
4. Make a recommendation with a one-line reason.
5. Surface the question — don't proceed.

**When surface-and-stop is the right move**: any time the immediate next file write would (a) red `pnpm check` AND (b) the plan claims subsequent commits will close it. The "GREEN per commit on the feature branch" stance is worth a small dispatch round-trip; Bentham reviews atom by atom, not "branch end-state vs trunk."

**When it's wrong**: when the type error IS the whole point of the commit (intentional API surface change with planned consumer updates in the same atom). Use judgement: is this a refactor where the type change AND consumer fixes belong in the same atom? Then don't split.

CHORE-B17 squash commit message acknowledged this pattern obliquely: "Post-design hotfixes during live-test (folded in via squash)" — five hotfix commits made it past the formal TDD chain because live-test surfaced things tests couldn't. The atomic-per-commit-GREEN discipline kept those hotfixes reviewable.

(*MVOX:Josquin*)

---

## [GOTCHA] 2026-05-23 session 17 — Stale task_assignment notifications arrive AFTER your completion report

Roughly half of the CHORE-B dispatches arrived to me as `{type: "task_assignment", ...}` JSON from team-lead WITH timestamps that PREDATED my own GREEN-report timestamp on the SAME task. Pattern: team-lead sends the task_assignment + the dispatch message, but the task_assignment notification arrives in my inbox after I've already completed the task and reported back.

Sequence observed (B1 → B14):
- 08:58:14Z task_assignment for #27 arrived AFTER my 09:11 GREEN report
- 09:16:10Z task_assignment for #30 arrived AFTER my 09:19 GREEN report
- 09:22:09Z task_assignment for #31 arrived AFTER my 09:25 GREEN report
- 09:29:22Z task_assignment for #33 arrived AFTER my 09:31 GREEN report
- 09:34:18Z task_assignment for #35 arrived AFTER my 09:36 GREEN report
- 09:42:51Z task_assignment for #37 arrived AFTER my own surface-and-stop msg (#37 in_progress, holding)
- 09:47:59Z task_assignment for #38 arrived AFTER my B12 surface-and-stop msg (#38 in_progress, holding)
- 10:06:25Z task_assignment for #40 arrived AFTER my 10:08 GREEN report
- 10:38:50Z task_assignment for #43 arrived AFTER my 10:42 Steps 1-3 report

Team-lead confirmed on the first one (09:15): "TaskUpdate-fires-notification artifact; ignore." Subsequent stale notifications get a one-line ack from me: "Stale task_assignment for #N — already completed at SHA (timestamp X)." Quiet but auditable.

**Don't let stale assignments make you redo work** — always check the task list state + your own previous report before reacting. The pattern is that TaskUpdate(owner=josquin) triggers an in-process notification that lags behind the original SendMessage dispatch + my own SendMessage report.

(*MVOX:Josquin*)

---

## [CHECKPOINT] 2026-05-23 session 17 — CHORE-B Path C shipped to production at `fc99291`

Squash-merged 18 feature commits + 5 live-test hotfixes into `feat(#53): CHORE-B -- Path C rewrite -- browser-direct Entu`. Net `+910 / -2490` (−1580 lines). PR #58 closed; branch `feat/chore-53b-rewrite` deleted local + remote. Issues #53 + #57 auto-closed by squash commit body. Production deploy: `https://multivox.pages.dev` at hash `a9c9ad88`. Smoke 200/200.

### What's on production after this merge

Path C end-state — mvox now mirrors `entu/webapp`:
- JWT in browser localStorage (not httpOnly cookie)
- Browser-direct calls to api.entu.app on every data path
- No BFF data routes (`/api/organizations/*` deleted)
- OAuth init + callback + logout all client-side
- 401 in any data call triggers involuntary re-auth via saved provider (state-encoded, not document.referrer)
- `hooks.server.ts` is pure pass-through
- `Locals.entuJwt` stripped from `src/app.d.ts`

### Durables worth keeping (beyond the per-task [PATTERN] entries above)

[CONTRACT] **The 5 live-test hotfixes captured architectural learnings worth preserving** — they're squash-folded but each was its own atomic commit on the branch:
- **`5aacd1c`**: bare `next=` URL + state to localStorage (mirror entu/webapp; the plan's `?state=&key=` pattern was a Path A vestige).
- **`0a2c7bd`**: provider encoded in OAuth state, closing #57 ("YELLOW-B.1 via document.referrer fragility"). State now `{provider, csrf}` not just CSRF — saves the saved-provider deterministically across cross-origin OAuth redirects where referrer is stripped (Google + Apple).
- **`4df0dea`**: dropped sessionStorage nonce verify on /auth/callback because it broke email auth (email's callback comes from a different origin than the init, so sessionStorage on init-origin isn't available on callback-origin). Decided IP-binding is the CSRF defense; sessionStorage was belt-and-braces that broke a provider. Lesson: belt-and-braces stacking adds failure modes too.
- **`2f771b8`**: layout nav reactive to localStorage state (signed-in/-out toggle didn't update on logout in another tab). storage-event listener pattern.
- **`f4f7a0a`**: gate auth-state UI on hydration (no flash of incorrect content). `let hydrated = $state(false); $effect(() => { hydrated = true; });` — render-shell-first, then derive auth state after mount.

[PATTERN] **Architectural rewrite gate sequence that worked**: full TDD chain (Tallis RED → Byrd/Josquin GREEN per atom) → Bentham review → squash-PR open → CF Pages **preview** deploy → PO live-test on preview (6 providers + edge cases) → only THEN squash-merge to main → production deploy → PO final-verify on production. The preview deploy was load-bearing — it surfaced 5 hotfixes that no test caught (auth-side bugs that only manifest with real Entu round-trip). Cannot architect-review your way to GREEN past a PO live-test for OAuth/architectural rewrites.

[PATTERN] **ASCII-only commit titles on CF Pages deploys** — wrangler rejects non-ASCII. Team-lead's session-17 dispatch flagged this; I used `--` instead of `—` and `'` instead of `'` in the squash commit. Documented in architecture-decisions if Bentham steward-edits it later, but tactical note: just default to ASCII in commit titles intended for CF Pages production deploys.

[PATTERN] **Stash dance for branch transitions when peers have dirty scratchpads**: `git stash push -m "<owner> scratchpad pre-<op>" -- teams/mvox-dev/memory/<owner>.md` before `git checkout main` / before push; `git stash pop` after. Done twice this session (B17 push + B17 merge); used `git stash push -m <label>` form for traceability when multiple stashes might queue.

### Open items at session-17 close

- **PO final-verify on production** (Step 7) — not yet relayed by team-lead at shutdown time. If it surfaces a regression, would land as fast-follow hotfix on main.
- **CHORE-C** — Playwright fixture rewrite for browser-direct mode. YELLOW-B.2 scope. 11 Playwright failures still in test:e2e; all pre-flagged + tracked. Tallis-owned.
- **Issues #16, #17, #19** — documentation / case study outputs (entu/research case study, Brilliant KB pattern, Argo ask). Deferred; not my scope.
- **CHORE-49 (Biome rule enablement)** — still deferred (5 sub-cycles). Lint:fix in GREEN discipline has held without it.

(*MVOX:Josquin*)

---

## [PATTERN] 2026-05-23 session 16 — GREEN agents must run `pnpm lint:fix`, not just `pnpm test`

CHORE-A's A5 verification gate (post-Byrd/Tallis GREEN reports for A1-A4) failed `pnpm lint` on 4 files: 3 from prior A1-A3 cycles (Byrd's `wrapper.ts`, Tallis's `wrapper.spec.ts` + `state.spec.ts`) + 1 from A4's Tallis RED (`client.spec.ts`). All 4 were Biome formatter complaints — line-break style on chained `vi.fn().mockResolvedValue(...)` calls — pure cosmetic, no semantic impact. `pnpm lint:fix` auto-resolved all 4 in one sweep.

**Root cause**: A1-A3 GREEN reports declared success on `pnpm test` + (optionally) `pnpm check`, but did not run `pnpm lint`. So 3 commits landed with formatter drift that only surfaced at A5's "final sweep" gate, which the plan explicitly requires lint to be clean.

**Pattern for future TDD chains**: the agent flipping RED→GREEN (Byrd or Josquin) must run `pnpm lint:fix` as part of GREEN verification before commit. The cost is ~200ms (Biome is fast) and prevents the "A5 gate finds formatter mess across 3 prior commits" mode that requires either a 4-round-trip dispatch or a scope-override autofix sweep (Palestrina authorized the latter as Option C, committed as `db59557`).

**Bentham angle**: worth lifting to `architecture-decisions.md` as a settled team norm if Bentham endorses on #56 review. Specifically: codify the per-commit lint requirement and possibly add a `prepare-commit-msg` or `pre-commit` hook that runs `biome check --write` against staged files only (mechanical, fast, reliable).

**One subtlety**: Biome's formatter rules are *defaults* — CHORE-48 installed Biome but deferred rule enablement to CHORE-49 (5 sub-cycles, deferred). Even with no custom rules enabled, Biome's default formatter is opinionated enough to catch these. So "run lint" is enforceable even pre-CHORE-49.

(*MVOX:Josquin*)

---

## [CONTRACT] 2026-05-23 session 16 — BFF route specs survive constructor-shape changes via `vi.stubEnv` indirection

CHORE-A A4 moved `EntuClient`'s constructor from `new EntuClient(jwt)` (reading `$env/dynamic/private` internally) to `new EntuClient({jwt, db, baseUrl})` (caller passes env). The two BFF route consumers (`/api/organizations/+server.ts` + `[id]/sections/+server.ts`) were updated. **The pre-existing route specs at `src/tests/routes/api/organizations/{server,id/sections/server}.spec.ts` continued to pass without ANY modification** — including the mock setup.

**Why**: those specs do `vi.stubEnv('ENTU_BASE_URL', '...')` + `vi.stubEnv('ENTU_DB', 'testdb')` + `vi.stubGlobal('fetch', mockFn)`. They never imported or mocked `EntuClient` directly. The route now reads `env.ENTU_DB` + `env.ENTU_BASE_URL` from `$env/dynamic/private` and passes them to the constructor, so `vi.stubEnv` transparently feeds the new code path. The new defensive `!res.ok` throw on `search()` doesn't fire in these specs because they all return `200` status on the mocked fetch.

**For CHORE-B**: when you rewrite the routes (or delete them under Path C), this pattern of "specs that test routes end-to-end via env-stub + fetch-stub, NOT via mocking internal modules" is the resilient pattern. As long as the env contract stays (`ENTU_BASE_URL` + `ENTU_DB`), the specs adapt automatically. If CHORE-B shifts the route to use a different env var or removes the env read entirely, the specs WILL need a sweep — but the breakage will be obvious (stub-then-nothing-reads-it).

**Cross-reference**: this is the same DI pattern Bentham would call "test boundary at the edge, not the seam" — mock at the network boundary (fetch + env), not at the SDK seam (EntuClient module).

(*MVOX:Josquin*)

---

## [CHECKPOINT] 2026-05-22→23 session 15 — 6 merges + 2 deploys + OAuth live success + /api/orgs 500 diagnosed

Session shipped 6 squash-merges (`8861bfe` #34, `edacaa6` #37, `8b76af8` #48 (Closes #25), `5b7a741` #24+#29, `bc1d1a7` #50, `63a4ce3` #51) and 2 production deploys (`9a4971ae` post-slate, `2fca359a` post-CHORE-51). PO completed Smart-ID full OAuth round-trip end-to-end on the post-CHORE-51 deploy (sign-in worked: JWT cookie set, signed-in landing rendered). Then `/api/organizations` 500'd on the first authenticated BFF call — surfacing the IP-binding architectural blocker described below.

### Durables worth keeping

[CONTRACT] **Entu's `{error: true, url, ...}` response shape on data-API auth failure.** Confirmed via direct probe of `https://api.entu.app/polyphony/entity?...` with invalid Bearer → HTTP 401 + body `{"error":true,"url":"...",...}`. Crucially, the body does NOT have an `entities` key. Any consumer that types the body as `{entities: EntuEntity[]}` and does `.entities` without `!res.ok` check will get `undefined` and explode downstream on `.map()`/`.length`/`.filter()`. Live captured stack 2026-05-23T00:18Z via `wrangler pages deployment tail`: `TypeError: Cannot read properties of undefined (reading 'map') at GET (bundledWorker-...mjs:7614:11)` in the `/api/organizations` route after `EntuClient.search` returned `undefined`. CHORE-52 will fix.

[GOTCHA] **`EntuClient.search` is missing the `!res.ok`-throw that `get` got in CHORE-34.** `src/lib/server/entu/client.ts:50-52` — direct asymmetry with `get` at L33-42 (which we explicitly pinned a spec for in CHORE-34 / commit `8861bfe`). Fix: mirror the same `if (!res.ok) throw new Error('Entu search ${this.db} failed: ${res.status}')`. The `setProperty` helper (L55+) likely has the same gap — audit when CHORE-52 GREEN starts. Pattern broader: any `EntuClient` method that calls fetch + casts JSON body needs the same `!res.ok` defense, or factor a shared `private async parseEntuJson<T>(res): Promise<T>` helper.

[GOTCHA] **IP-bound JWT (`aud=<user-IP>`) breaks BFF server-side proxying entirely.** Confirmed via captured PO JWT: `"aud": "82.131.122.238"` (PO's home IP). The session-14 [CONTRACT] (L40-41) already flagged this for session-token exchange — the client-side `exchange.ts` carve-out exists because Entu's session-token is IP-bound. But the SAME constraint applies to the 48h JWT that exchange returns: PO's browser sends cookie, CF Worker forwards to Entu from FRA colo IP ≠ PO's IP, Entu sees `aud` mismatch, returns 401 with `{error:true}` shape. **The entire BFF rights-aware data path is architecturally broken for IP-bound JWTs.** This is the root cause of /api/organizations 500 — not the missing `!res.ok` check (which is a proximate symptom-amplifier). Three architectural options to resolve (CHORE-53 territory):
1. **Entu issues non-IP-bound JWT for BFF use case** — service-token grant or OAuth client_id flow; needs Entu-side change; preserves user-rights-default arch.
2. **Client-side direct data calls** — browser fetches Entu directly with JWT; violates BFF-as-single-surface stance + exposes Entu API to client.
3. **BFF holds shared API key + impersonates user** — needs `_owner=true` impersonation feature in Entu OR a per-user API-key issuance flow; violates user-rights-default + drift toward open-platform stance.

Recommendation when CHORE-53 lands: get Finn to research Entu's options; Victoria drafts impact on the existing BFF rights design in `architecture-decisions.md`; PO chooses.

[PATTERN] **Live CF Worker diagnostic via `wrangler pages deployment tail` foreground-timeout.** Use `timeout 30 pnpm wrangler pages deployment tail <deployment-uuid> --project-name multivox --format json > /tmp/cf-tail.log` and have PO retry the failing action while the tail is running. Captures full stack + logs + headers in JSON. **Do NOT use `nohup ... & disown`** — backgrounded processes across Bash calls get killed (the harness doesn't preserve fully-detached processes between tool calls; my first attempt logged 0 events). Foreground with `timeout` is the reliable pattern. The JSON output has `event.request.url`, `event.response.status`, `exceptions[].name/message/stack`, `logs[].message` — sufficient to pin a SvelteKit `bundledWorker-*.mjs` exception to a specific source line by matching the bundled line number to the route's GET handler.

[GOTCHA] **`pnpm wrangler login` requires xdg-utils.** Without `xdg-open` binary, wrangler crashes at 42ms with `FileNotFoundError: spawn xdg-open ENOENT` BEFORE starting the local OAuth callback server. Even if PO manually opens the browser and completes auth, the callback (`localhost:8976/oauth/callback`) has nowhere to land → token never persisted. Detected via metrics line `"errorType":"FileNotFoundError"` + `"isInteractive":false`. Fix: `sudo apt-get install -y xdg-utils` OR use API-token path (`CLOUDFLARE_API_TOKEN` env). The credentials-source pattern documented in Pérotin's prompt (`set -a; . ~/.config/mvox/credentials.env; set +a`) covers this elegantly — `~/.config/mvox/credentials.env` already contains both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from a prior session. Use this pattern for all deploys; don't fight the OAuth flow.

[DECISION] **ENTU_API_BASE unified at `https://api.entu.app/` (CHORE-50).** Subdomain form serves all three Entu surfaces:
- OAuth init: `${base}auth/{provider}` → `https://api.entu.app/auth/smart-id`
- Session-token exchange (CHORE-51 wire shape): `${base}auth?db={db}` → `https://api.entu.app/auth?db=polyphony`
- Data API: `${base}{db}/entity?...` → `https://api.entu.app/polyphony/entity?...`

One constant covers all three. The old path-form `https://entu.app/api/` was incorrect for ALL surfaces — only OAuth init surfaced the bug because data API never fired live until post-sign-in tonight. The migration scripts always used the subdomain form (against live polyphony), which was the prior production-side evidence. Source: `src/lib/entu-config.ts`.

[CONTRACT] **Test fixture vs source-default discipline (CHORE-50 + CHORE-51 confirmed).** When a spec pins the SOURCE default value as a literal, and the source default is itself wrong/changing, the spec moves with the fix. When a spec mocks an `ENTU_BASE_URL='https://entu.app/api/'` env override, that's pinning env-override BEHAVIOR (not the source default) — leave those alone even when source default changes. CHORE-50 updated `entu-config.spec.ts:18` (source pin) but NOT the 6 spec files mocking the env-override. CHORE-51 updated `callback-exchange-helper.spec.ts:67` (assertion pinning old path-form, contradicted by RED's "does not contain /${DB}/auth"). Bentham endorsed both calls. The principle: ask "is this assertion about the SOURCE DEFAULT or about ENV OVERRIDE BEHAVIOR" before touching.

[PATTERN] **Stash dance for scratchpad-dirty squash-merges scales to 4+ files.** The session-14 L29 pattern (`git stash push -- teams/mvox-dev/memory/`) handled 3-4 dirty scratchpads cleanly across 6 squash-merges this session. Variant observation: if `git stash push` reports "No local changes to save" at chain start (harness flipped to clean main), the trailing `git stash pop` still restores anything queued from an EARLIER stash. End state after each merge: scratchpads back in dirty/unstaged state per usual. No special handling needed.

[PATTERN] **OAuth callback shape (CHORE-50 + CHORE-51 combined).** After CHORE-50: provider URL is `https://api.entu.app/auth/{provider}?next=<encoded-callback>` with state ONLY inside the encoded `next` (no top-level `&state=`). The callback URL inside `next` decodes to `https://multivox.pages.dev/auth/callback?state=<csrf>&key=` — Entu appends the session token after `&key=`. After CHORE-51: client-side `exchange.ts` POSTs `https://api.entu.app/auth?db=polyphony` with `Authorization: Bearer <session-token>` + `Accept: application/json`. The 48h JWT comes back, gets POSTed to mvox `/auth/cookie` via the BFF, then stored as `entu_jwt` httpOnly cookie. **Sign-in completes successfully at this point.** The IP-binding bug only surfaces on the FIRST subsequent server-side BFF call to `/api/organizations` (and presumably any other data-API route).

### Deferred / open items at session-15 close

- **CHORE-52** — defensive `!res.ok` throw in `EntuClient.search` (+ likely `setProperty` audit) + route handler error mapping. Mirrors CHORE-34 pattern. ~15 min GREEN; tonight-or-next-session.
- **CHORE-53** — BFF + IP-bound JWT architecture. Needs Finn research, Victoria draft, PO decision between the 3 options above. May require an entu/research PR to add non-IP-bound JWT issuance for BFF use cases. **This blocks ALL post-signin data flow** — until resolved, mvox is "signs in but doesn't show data".
- **YELLOW-50.1 + YELLOW-51.1** — `architecture-decisions.md` L204 stale wire-shape literal needs update; Bentham folds in his next stewardship pass.
- **GitHub issue closure** — #50 and #51 are still open (`Refs` not `Closes`); team-lead closes after CHORE-52/53 resolution context lands.
- **5-min nohup tail attempt** — `/tmp/cf-tail-orgs-long.log` empty because backgrounded process died across Bash calls. Use foreground+timeout pattern in future diagnostics.

---

## [CHECKPOINT] 2026-05-22 session 14 — #40 / #41 / #45 / #42 / #46 / #47 merged + mvox live on multivox.pages.dev

Session shipped six PRs to main and got mvox publicly reachable for the first time. Merge SHAs (in order): `a120248` #40, `a506266` #41, `52a5fca` hotfix (nodejs_compat), `2fa3b7b` #45, `c490591` #42, `bb12049` #46, `c73b82b` #47. Tests landed at 403/403; `multivox.pages.dev` HTTP 200; OAuth flow live with CSRF binding + JWT cookie session.

### Durables worth keeping (ephemeral PR-detail pruned)

[GOTCHA] **`pnpm deploy` is shadowed by pnpm's reserved workspace subcommand.** `pnpm deploy` returns `ERR_PNPM_CANNOT_DEPLOY`. Always use `pnpm run deploy` for npm-script-defined deploy. Documented in `docs/operations/deploy.md` with explicit callout near the top. Forgetting this once = ~2min of confused dispatch surfacing.

[GOTCHA] **Cloudflare Pages projects on this account are Direct Upload (no git provider).** Created via `pnpm wrangler pages project create multivox --production-branch main`. Push-to-main does NOT auto-deploy; need explicit `pnpm run deploy --branch main` to populate the canonical URL. Feature-branch deploys land at `<hash>.multivox.pages.dev` + `<branch>.multivox.pages.dev` aliases but NOT canonical. Verified via `wrangler pages project list` → `Git Provider: No` across all 6 projects on the account. CHORE-43 tracked if PO ever wants to wire CF↔GitHub OAuth.

[GOTCHA] **`compatibility_flags: ["nodejs_als"]` does NOT expose `process` global in CF Workers — `nodejs_compat` does.** `als` is older/partial (AsyncLocalStorage only). Cost us a half-deployed `/auth/login` 500 (`ReferenceError: process is not defined`) before the hotfix. **Belt-and-braces stance**: even after CHORE-47 migrated all 5 call sites to `$env/dynamic/private`, the `nodejs_compat` flag stays in `wrangler.json` as defense-in-depth for transitive deps that might do `process.X` internally. The flag is no longer load-bearing for our own env access but remains a safety net.

[PATTERN] **Stop-and-surface beats blind retry on deploy failures.** Both deploy errors this session (`Project not found 8000007` then `process is not defined`) were diagnosed in <2 minutes via `wrangler pages deployment tail <deployment-id> --format json` + JSON inspection. The `tail` subcommand requires the specific deployment ID (not just project name) in non-interactive mode. Pattern: on CF deploy 500, grab `wrangler pages deployment list --project-name <name>` for the latest deployment ID, then `wrangler pages deployment tail <id> --format json > /tmp/cf-tail.log` while hitting the failing route. The structured logs include `logs[].message` with the actual stack trace.

[PATTERN] **`$env/dynamic/private` in vitest requires explicit handling.** SvelteKit's virtual module isn't resolvable outside `vite dev`/`vite build` context. Two options that both work:
- Per-spec `vi.mock('$env/dynamic/private', () => ({ env: mockEnv }))` with a mutable `mockEnv` object (Tallis's pattern across 4 OAuth specs).
- Global default via `vitest.config.ts` `setupFiles: ['src/tests/setup.ts']` that mocks with `{ env: {} }` — per-spec overrides still work (vitest mock-hoisting respects later mock declarations).

The global setup is required for any spec that TRANSITIVELY imports migrated code (e.g., `api/organizations/server.spec.ts` doesn't touch env directly but imports `EntuClient` which now imports `$env/dynamic/private`). Without the setup file, 27 specs that pre-existed CHORE-47 will RED on "Cannot find module".

[PATTERN] **Squash-merge chaining defends against harness-branch-flip mid-sequence.** Per the auto-memory feedback I noticed: `git checkout main && git pull && merge --squash <branch> && commit && push && push --delete && branch -D` chained in a single Bash call. The harness sometimes flips branches between Bash calls if multi-call sequences span unrelated tool calls; chaining everything atomic blocks the flip. Used 6 times this session without state loss. Caveat: stash-then-chain still needed if the worktree has unstaged teammate scratchpad edits.

[PATTERN] **`git stash pop` refuses 3-way merge when worktree already has matching unstaged content.** Symptom: pop fails silently with "stash entry is kept" but no obvious error. Fix: `git add <file>` first to move worktree state into the index, then `git stash apply` (which DOES force 3-way) → resolve markers → `git stash drop`. Encountered when popping 3 session-14 stashes onto a worktree that already had scratchpad edits. The stash-pop dance for end-of-session reconciliation needs the apply+drop variant whenever the destination file is dirty.

[PATTERN] **Test fixture path resolution via `new URL('../../../', import.meta.url)`.** From spec file at `src/tests/deploy/no-process-env.spec.ts`, walking up THREE levels lands at the repo root (`/home/michelek/workspace`). FOUR levels overshoots by one. Tallis's first version overshot, making `existsSync` return false and the meta-spec pass vacuously. **Always verify a regression-net meta-spec actually red-flags a known violation BEFORE declaring RED phase done.** This is the L40-style "vacuously-passing spec" anti-pattern; Bentham caught the same class of bug in session 13 with the `.skip()` test that referenced a non-existent feature.

[CONTRACT] **CSRF gate sequencing on `/auth/cookie`: read → 403-if-missing → delete-always → JWT-validate.** Order matters: csrf_state cookie is single-use, so delete BEFORE JWT validation aborts. Otherwise malformed/expired JWT paths leave csrf_state intact for replay-after-shape-fix. Bentham encoded this as a review PATTERN in his scratchpad; worth mirroring here because future BFF endpoints that consume single-use cookies should follow the same shape.

[CONTRACT] **`/auth/login` server-load shape** (what Byrd consumes):
```typescript
{ providers: Array<{ id: string; label: string; url: string }> }
```
Each `url` is a fully-formed Entu OAuth URL with the csrf_state both as a top-level `&state=` (for the assertion regex pattern Tallis pinned) AND inside the encoded `next=` callback (for Entu to redirect back with). 6 providers in PO-locked order: `smart-id`, `mobile-id`, `id-card`, `google`, `apple`, `e-mail`.

[CONTRACT] **`/auth/callback` server-load shape** (what callback page's client JS consumes): `{ sessionToken: string; db: string }`. NO server-side Entu call (per `expect(event.fetch).not.toHaveBeenCalled()` invariant). Exchange happens client-side via `src/lib/auth/exchange.ts` because Entu's session token is IP-bound and CF Workers don't preserve client IP on outbound.

[DECISION] **Single source of truth for Entu base URL: `src/lib/entu-config.ts` exports `ENTU_API_BASE = 'https://entu.app/api/'`** (path form, trailing slash). Lives OUTSIDE `src/lib/server/` so both server (`client.ts`, `auth/+server.ts`, `auth/login/+page.server.ts`) and client (`auth/exchange.ts`) can import without crossing the server-only boundary. The `DEFAULT_BASE_URL` alias was dropped in CHORE-45 YELLOW-45.2; all consumers now `import { ENTU_API_BASE }` direct.

[DECISION] **Co-located config zone: `src/lib/<topic>-config.ts` is the home for cross-boundary VALUES** (URLs, timeouts, port numbers). Reserve `src/lib/types.ts` for cross-boundary TYPES; reserve `src/lib/server/<feature>/` for server-only feature code. Bentham logged this PATTERN; encode here too for future similar decisions.

### Deferred / open items at session-14 close

- CHORE-43 — Wire CF Git Provider integration (one-time CF↔GitHub OAuth grant) to enable push-to-main auto-deploys. PO-scope.
- YELLOW-41.3 — JWT signature verification on `/auth/cookie`. Deferred until Entu publishes JWKS or we settle on a verification library.
- `nodejs_compat` flag removal — could be revisited now that CHORE-47 landed, but defense-in-depth posture stands. Don't remove without a probe-then-implement step.
- Tallis's `tests/oauth-flow.spec.ts` Playwright suite has all tests `.skip()` pending issue #36 (mock-Entu E2E harness).

---

## [CHECKPOINT] 2026-05-22 session 13 — #32 merged @ `8fd3ed0`, #35 merged @ `db2040e`

Both PRs landed on main this session. Key durables below; ephemeral PR-detail pruned.

### #32 BFF MVP — orgs + sections endpoints

[PATTERN] **Vitest doesn't resolve `$lib`** — confirmed again. Route handlers tested via vitest must use relative imports (`../../../lib/server/entu/client.ts`). Same gotcha as 2026-05-21 (`client.spec.ts`); reappeared here for `+server.ts` imports inside `vi.resetModules()` dynamic-import test pattern. Mental model: if a file is reachable from a vitest spec via `import()`, traverse cross-tree with relative paths only.

[PATTERN] **BFF JSON-envelope errors > SvelteKit `throw error()`.** Bentham settled this on the #32 review (now in `architecture-decisions.md`): all BFF errors `return json({ error: '<code>' }, { status })`. Predictable JSON for frontend consumers; tests pin `body.error === 'auth_required'`. Use `throw error(...)` only when you want SvelteKit's HTML error page — never for `+server.ts` API routes.

[PATTERN] **Property extractor helpers stay inlined until route 3.** GH #33 tracks factoring to `src/lib/server/bff/{pagination,props}.ts` when the third `+server.ts` lands. Until then the duplication is "three similar lines" territory. Bentham YELLOWs at 4× duplication; REDs when route 3 ships without the factor.

[GOTCHA] **Voice is a composite multi-value.** v4E section.voice is declared `reference`, but Entu surfaces `{ reference: 'voice-id', string: 'voice-name' }` per value. Tests expect `{ _id, name }` in the response — both from the same property value, no second fetch. If a future reference property needs the same shape, name the helper `extractReferenceWithLabel` not `extractVoice`.

[GOTCHA] **`EntuClient.get` throws on !res.ok.** Route uses `.catch(() => null)` to collapse Entu 403+404 → 404 (hide existence). GH #34 tracks adding direct `client.spec.ts` tests pinning the throw behavior — Tallis-owned. Indirect coverage via route specs is GREEN-eligible but not durable on its own.

### #35 Frontend Scaffolding — server load + landing

[CONTRACT] **Three-branch server-load shape.** `src/routes/+page.server.ts` returns one of:
- `{ session: null, orgs: null }` — no entuJwt
- `{ session: { jwt }, orgs: OrgEntity[] }` — signed-in, BFF 200
- `{ session: { jwt }, orgs: null, error: true }` — signed-in, BFF non-200 or fetch threw

Reusable shape for future authenticated landing-style routes. Session is currently `{ jwt }`; GH #39 tracks lifting to `+layout.server.ts` once a second authenticated route needs it.

[DEFERRED] **CHORE-36 — mock-Entu E2E harness.** Byrd's #35 landed with `+page.svelte` using a browser-side `$effect` fetch instead of `data.orgs`, because Playwright's `page.route()` can't intercept SvelteKit's internal `event.fetch` (server-side node fetch bypasses Chromium's network layer). One Playwright test (SSR-presence) is RED as a result. PO decided ship-with-YELLOW; CHORE-36 will stand up a mockable Entu HTTP layer beneath SvelteKit, flip the landing to seed orgs from `data.orgs`, drop the `$effect`-on-mount, turn the 18th test GREEN. Rights-aware contract doc §1 BFF-as-single-surface isn't violated in prod — the `$effect` is a CI accommodation, not an architectural shift.

[LEARNED] **Test-environment constraints can dominate design-doc posture.** I argued for "remove `$effect`, seed from `data`" based on the rights-aware design doc. Byrd pointed out that with no Entu in CI, the server load returns `error: true` regardless, so my proposal would have broken 17 GREENs while still not earning the 18th. **The right framing was the test infra, not the code shape.** Future-self: when proposing a design change that interacts with tests, first ask "what does the test environment actually allow?" before invoking the design doc.

[LEARNED] **Conceding fast when wrong is cheap; doubling down is expensive.** When Byrd's option-C analysis arrived, I checked the numbers, found he was right, and reframed in the next message rather than defending the prior position. Took ~3 minutes; lost nothing. Pattern worth keeping: validate the counterargument's claims numerically, then either rebut with specifics or yield clean. Don't litigate framing.

---

## [DECISION] 2026-05-22 session 12 — BFF rights-aware design APPROVED, merged to main at `e42cb1e`

PO walked Q1-Q5 in session 12. All five answered, design doc finalized + `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md` written as a paste-ready entu/research PR draft. Both files merged to main at `e42cb1e` (team-lead per the shutdown note). Implementation now gated on the upstream rename PR landing + Pérotin migrating polyphony db; mvox impl PR (first to consume `organization.photo` + `_thumbnail`) must carry the `Schema-Change:` + `PO-Approved:` trailers per session-2 convention.

**Locked answers** (full table in design doc §0; one-liner each here for fast recall):
- Q1 orgs-list scope: **rights-driven** (trust Entu's filter; orphan cascade = cleanup task)
- Q2 empty-state: **generic** (no `rights_state` hint; would require elevation → violates §1)
- Q3 pagination: **`limit=50` default, `200` max, offset `?limit=N&skip=M`** 1:1 with Entu
- Q4 shape: **narrow / typed per-endpoint**
- Q5 file URLs: **rename `avatar`+`logo` → `photo`** to unlock Entu's hardcoded `_thumbnail` → `photo` resolver (one-hop signed S3, anonymous-capable for `sharing: 'public'`)

**Finn's `_thumbnail` finding worth keeping** (won't re-derive): `entu/api/utils/entity.js` `cleanupEntity` does the resolution; it looks for a property literally named `photo`. `picture` is NOT special (zero refs across `entu/api` + `entu/app`). `?props=_thumbnail` on entity/search populates `_thumbnail` inline as a 60s pre-signed URL — no second property fetch. Only resolves a single property, so `list: true` file collections (e.g. `edition.file`) don't benefit and were excluded from the rename.

**Implementation-phase blockers (refreshed)** — in dependency order:
1. **entu/research rename PR lands** — PO submits using the paste-ready findings doc; capture merge SHA for the mvox impl trailer.
2. **Pérotin polyphony data migration** — type-def name update + ~2 person + ~6 org instance value re-attaches under new property name. Manifest-first pattern.
3. **#19 CSRF gate** — still pending; required before the FIRST mutation route, not the first read. MVP surface is GET-only so the first impl PR doesn't need it; second impl PR does. Recommended path (design doc §6): SvelteKit's built-in `csrf.checkOrigin` (default-on).
4. **base URL split** (`entu.app/api/` path-form vs `api.entu.app/{db}/` subdomain-form) — still out of scope until a real BFF caller exists; first impl PR is that caller, so flag + probe at that PR. See 2026-05-21 GOTCHA below.

## [PATTERN] 2026-05-22 session 12 — surface "regen ripple" in cross-repo schema PR drafts

The entu/research rename PR draft mostly wrote itself, but one non-blocking question surfaced at report time: should the PR include the regenerated `schema.json` (via `pnpm build-schema` per the header comment of `schema.ts`) in the same commit, or as a follow-up? I flagged it to team-lead rather than guessing.

**Generalizable:** any time a v4E schema change is being drafted for entu/research, check `schema.ts` header comment for build-artefact regen instructions. If there's one, mention it in the report-out — PO can decide single-commit (schema + regenerated artefact, keeps upstream CI green) vs two-commit (schema then regen). My default recommendation in the report was single-commit. Either is fine; the cost of NOT mentioning it is upstream catching it at PR review and bouncing.

Small pattern but easy to forget when most of the work is the diff itself — the "what gets regenerated by this change" question is invisible from inside `schema.ts` unless you scroll up to the header. Worth a 30-second sweep at draft time.

## [LEARNED] 2026-05-22 session 12 — self-calibration carried forward, all three calls held

The three calibration points from session 11 (empty elevated-ops list, generic empty-state, narrow typed shapes) all survived PO review without revision — Q2 Q4 Q5 all came back resolved as recommended. The one I half-expected to bounce was Q4 (narrow vs passthrough); writing it out as "BFF-as-contract posture demands shaping" was apparently load-bearing for the call. Lesson: when an instinct disagrees with what writes well, follow the writing — the post-hoc justification IS the actual reason. Will lean on this when next torn between velocity-shape and contract-shape.

## [LEARNED] 2026-05-21 session 11 — docs-only branch flow

For docs-only PRs (no `src/` edits), the branch convention is `docs/<topic>` rather than `feat/<issue>` — there's no issue, no TDD chain, no Bentham gate. Workflow:

1. Branch from main, write the doc, commit (auto-co-author trailer), `git push -u origin <branch>`.
2. Do NOT merge — PO reviews on origin via the GitHub UI before greenlighting.
3. The branch stays open across sessions until PO either approves (then squash-merge per usual) or asks for revisions.

Differs from feature branches because:
- No local-only convention — push to origin so PO can review the rendered markdown on GitHub.
- No squash-merge in the same session — design proposals are PO-gated, not engineer-gated.
- Memory file mods in the working tree at the time of `git checkout -b` still tag along; stage carefully (just the doc).

I used this for the BFF rights design today. Same pattern works for any future design proposal (`docs/<topic>` branch, push-don't-merge, PO reviews on GitHub).

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
