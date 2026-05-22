# Task List Snapshot — 2026-05-22 (end of session 13)

State at shutdown. If session 14 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 3 | Layer 2 photo file-payload probe + impl | pending | — | Empirical probe: does Entu's POST-with-file-fields re-link to a pre-existing S3 object after DELETE of previous property value, or does it require fresh upload? Probe answer determines whether file-property rename is doable as DELETE-then-POST or requires download-via-signed-URL + re-upload. After probe: implement Layer 2 of the photo-rename cleanup with correct file-value round-trip + extend EntuProperty type (YELLOW-12.2) + widen probe-rename-photo-impact to capture all file-value fields (YELLOW-12.1). **Fires only if:** (a) someone uploads an `avatar`/`logo` instance value before Layer 2 lands, OR (b) BFF needs `_thumbnail` working on real data with uploaded files. **Status as of session 13 close:** 0 file values exist on `person.photo` or `organization.photo` in live polyphony — Layer 1 prop-def rename landed at `82727ca`; no instance work needed yet. Defer to when trigger fires. Layer 2 implementation NOT yet routed to Pérotin. |

Tasks #1 (CHORE-32 BFF MVP) + #2 (CHORE-35 Frontend scaffolding) closed this session.

Session-13 carryforwards filed as GH issues (still applicable for future sessions):

| GH # | Subject | Notes |
|---|---|---|
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records. Re-check next session start. |
| #19 | ADMIN-1: Create season | Open user story (admin scope) |
| #29 | docs: CONTRIBUTING.md follow-ups | Low priority, includes YELLOW-3.2 commit-body AC bullet |
| #30 | YELLOW: CSRF gate at first cookie-authed BFF mutation route | Fires on first cookie-authed mutation route PR. |
| #31 | YELLOW: relax CHORE-2 OKLCH color regex on next Tailwind upgrade | Fires on next `tailwindcss` minor/major bump. |
| #33 | YELLOW-32.1: factor BFF helpers to shared module on next route | Fires when route #3 lands. |
| #34 | YELLOW-32.2: pin EntuClient.get() 403/404 throws in client.spec.ts | Tallis-owned, ~10 lines. Independent fold-in. |
| #36 | CHORE-36: E2E Entu mock harness + flip landing page to SSR consumption | Authoring convention: new BFF-consuming pages default to SSR + .skip() SSR-presence tests pending. ~1 day single PR. |
| #37 | YELLOW-35.1: i18n gap — hardcoded "members/section" in landing | Comenius, ~10 lines. Independent fold-in or with section-drill-down. |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup (OrgEntity to types.ts + $app/state) | Byrd, small. Pairs with #33 or with next Byrd-touched feature. |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | Josquin + Tallis (specs update). Becomes RED for next authenticated route. |

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Session 13 outcome summary

- ✅ **#32 BFF MVP** — full TDD chain landed (Tallis RED → Josquin GREEN → Bentham GREEN with 2 YELLOWs → Josquin merge). Squash `8fd3ed0`. Closed.
- ✅ **#35 Frontend scaffolding MVP** — full TDD chain landed (Tallis RED → Josquin server-load + Byrd Svelte GREEN co-owned → Comenius i18n → Bentham GREEN with 4 YELLOWs → Josquin merge). Squash `db2040e`. Closed.
- ✅ **Photo-rename Layer 1** — entu/research#49 opened + merged by team-lead end-to-end (first exercise of the upstream-PR ownership shift). Pérotin live execution on polyphony at `82727ca` clean. Schema-mutation trailers verified on both #32 and #35 (where required).
- ✅ **Schema-mutation upstream-ownership norm encoded** in common-prompt.md + architecture-decisions.md (commit `a011af0`).
- ✅ **Two settled patterns** added to architecture-decisions.md (commit `14859cb`): "Bundled-migration RED → split-by-blast-radius" + "File-property mutations must round-trip full file payload".
- ✅ **Bentham prune-timing nudge taken + load-bearing patterns promoted** to architecture-decisions.md before scratchpad prune.

### Forward-looking work unblocked for session 14

- **Headline: CHORE-C (deployment pipeline) + CHORE-D (real OAuth) if scope allows.** PO call this session. First time mvox reachable via a public URL.
- **Section drill-down** (`/orgs/[id]` consuming #32's second endpoint) — phase 3 of the BFF/frontend stack. Natural pair with #37 + #38 + #39.
- **CHORE-36** — Entu mock harness + SSR flip; sets the convention going forward.

### Team composition this session

All 7 spawned agents performed cleanly. One process-deviation noted (Tallis misread task subject as Byrd-only assignment; clarified inline, no work lost).

- **finn** — idle all session (no research requests landed; #32 + #35 ACs sufficient on their own)
- **bentham** — 4 reviews/verdicts: (1) Layer 1 post-exec GREEN, (2) prune-timing nudge taken + patterns promoted, (3) #32 GREEN with 2 YELLOWs, (4) #35 GREEN with 4 YELLOWs
- **perotin** — 1 dispatch: Layer 1 live execution (2 prop-def renames, exit 0, post-exec probe PASS)
- **tallis** — 4 dispatches: (1) #32 RED, (2) #35 RED, (3) #35 import-path clerical fix, (4) #35 import-path + cast clerical fix + SSR-presence `.skip()`
- **josquin** — 5 dispatches: (1) #32 GREEN, (2) #32 squash-merge, (3) #35 server-load GREEN, (4) #35 squash-merge, (5) architectural fork triage (correct self-reconcile on CSR vs SSR)
- **byrd** — 1 dispatch: #35 Svelte files GREEN (chose CSR shape; architectural framing reconciled with Josquin)
- **comenius** — 1 dispatch: #35 i18n on 10 keys × 4 locales

## Repo state at shutdown (session 13)

- **Branch:** `main` at `5249eca` (or shutdown commit, whichever is last; pushed)
- **All feature branches deleted** (`feat/bff-orgs-sections-mvp` + `feat/frontend-scaffolding-mvp` cleaned up post-merge by Josquin)
- **Working tree:** memory file mods staged for shutdown commit (this snapshot + team-lead seed)

### Session 13 commit chain on main (chronological)

1. `a011af0` chore(mvox-dev): encode upstream schema-PR ownership norm + bentham prune
2. `82727ca` chore(migration): rename person.avatar + organization.logo to photo on polyphony
3. `14859cb` chore(mvox-dev): lift bentham patterns to architecture-decisions + prune-timing nudge
4. `4711d58` chore(tallis): session-13 checkpoint — CHORE-32 RED phase complete
5. `8fd3ed0` feat(#32): BFF MVP — GET /api/organizations + GET /api/organizations/[id]/sections
6. `d543f35` chore(mvox-dev): session-13 scratchpad updates — Bentham #32 review + Josquin merge
7. `809de20` chore(tallis): session-13 checkpoint — CHORE-35 RED phase complete
8. `db2040e` feat(#35): frontend scaffolding MVP — shared layout + landing page + login shell
9. `5249eca` chore(mvox-dev): session-13 scratchpads — Bentham #35 review + Byrd GREEN notes
10. (this session's shutdown commit — final commit of session 13)

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 13:** #32 (BFF MVP), #35 (frontend scaffolding)
- **Opened in session 13:** #32 (BFF MVP — closed same session), #33 (YELLOW-32.1), #34 (YELLOW-32.2), #35 (frontend scaffolding — closed same session), #36 (CHORE-36 mock harness), #37 (YELLOW-35.1), #38 (YELLOW-35.2+35.3), #39 (YELLOW-35.4)
- **Open issues at end of session 13:** #6 (Email), #7-#18 (user stories), #19 (ADMIN-1 season), #20-#23 (admin stories), #24 (README), #25 (packageManager), #29 (CONTRIBUTING), #30 (CSRF), #31 (OKLCH), #33, #34, #36, #37, #38, #39

### External activity this session

- **entu/research#49** — schema rename PR opened + reviewed + merged end-to-end by team-lead (first exercise of the upstream-PR ownership shift). Merge SHA `f52adc4` is the canonical Schema-Change trailer value.

## Polyphony Entu db state at shutdown (session 13)

- **person:** 122 instances (2 real + 120 v4E-clean seeds). 0 file values on `person.photo`. Prop-def renamed from `avatar` → `photo`.
- **organization:** 6 instances + 1 TYPE entity, all `_inheritrights=false`. 0 file values on `organization.photo`. Prop-def renamed from `logo` → `photo`.
- **affiliation / inventory_copy / participation / role:** still retired (0 instances).
- **menus:** 24 total (unchanged).
- **Layer 2 (instance-value migration):** still deferred — fires when actual `photo` values land or BFF needs `_thumbnail` on real data.

## External artifacts created this session

- `docs/architecture/bff-rights-aware-contracts.md` — no edits this session (APPROVED status from session 12 stands; consumed by #32)
- `src/routes/api/organizations/+server.ts` — new (#32)
- `src/routes/api/organizations/[id]/sections/+server.ts` — new (#32)
- `src/lib/server/entu/client.ts` — modified (`get()` throws on `!ok`; #32)
- `src/routes/+layout.svelte` — new (#35)
- `src/routes/+page.svelte` — new (#35)
- `src/routes/+page.server.ts` — new (#35)
- `src/routes/auth/login/+page.svelte` — new (#35)
- `src/tests/routes/api/organizations/server.spec.ts` — new (#32)
- `src/tests/routes/api/organizations/id/sections/server.spec.ts` — new (#32)
- `src/tests/routes/landing/page.server.spec.ts` — new (#35)
- `tests/frontend-scaffolding.spec.ts` — new (#35; 1 `.skip()` pending #36)
- `messages/{en,et,lv,uk}.json` — 10 new locale keys (#35)
- `scripts/migrations/probes/probe-rename-photo-impact-2026-05-21.ts` — merged from prestage branch (session 12 work)
- `scripts/migrations/cleanup-rename-photo-prop-def-only-2026-05-21.ts` — merged from prestage branch
- 4 result artifacts in `scripts/migrations/seed-results/` (probe + dry-run + live-run + earlier dry-run)
- Multiple scratchpad updates across `team-lead.md`, `bentham.md`, `byrd.md`, `josquin.md`, `tallis.md`, `comenius.md`, `perotin.md`, `i18n-conventions.md`

(*MVOX:Palestrina*)
