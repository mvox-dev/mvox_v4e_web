# Task List Snapshot — 2026-05-23 (end of session 15)

State at shutdown. If session 16 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs. Most active work is parked behind the CHORE-53 architectural decision.

## Active tasks at shutdown

None in_progress at the harness level (all session-15 dispatched work completed in-flight). The work that's open for session 16 is captured in GH issues (see below) and the [NEXT SESSION] seed in `team-lead.md`.

## Open GH issues — priority for session 16

| GH # | Subject | Notes |
|---|---|---|
| **#53** | **CHORE-53 — BFF + IP-bound JWT architectural decision** | **THE headline.** PO must pick Path B vs Path C. Brainstorming session needed. Path A rejected ("if we have to own rights management, why use Entu at all"). Until this settles, no implementation can move. |
| **#52** | CHORE-52 — EntuClient.search defensive !res.ok throw | Mirrors CHORE-34's `get()` pattern. Stops misleading 500 TypeError; doesn't fix root cause. Independent of #53; can land before or after arch decision. ~15 min full TDD chain. |
| #3 | Layer 2 photo file-payload probe + impl | Still deferred — fires only when actual photo uploads happen OR BFF needs `_thumbnail` on real data. Not yet triggered. |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records. Re-check next session. |
| #7-#18 | A1-D2 user stories | Backlog (singer + conductor + dashboard scenarios) — defer until arch decision lands and OAuth flow is end-to-end functional. |
| #19-#23 | ADMIN-1 through ADMIN-5 | Admin user-story backlog — same defer reason. |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump. |
| #33 | YELLOW-32.1: BFF helper factor-out on next route | **Becomes moot if Path C lands** (BFF data routes get deleted). Skip if Path C; relevant if Path B. |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Lower priority until arch decision lands. Same Path-C-makes-moot concern (different route shape). |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Independent fold-in or with next Byrd touch. May survive Path C. |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | Same Path-C-makes-moot concern; defer. |
| #43 | CHORE-42: Wire mvox.eu custom domain | PO owns mvox.eu at Zone.ee. DNS work + CF dashboard add. Independent of arch decision. |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected mode | Delete + recreate via CF dashboard "Connect to Git" wizard. Brief outage during swap. Independent of arch. |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Install landed in `8b76af8`. Stays open until CHORE-49 sub-rule cycles complete. |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency. Each sub-rule gets its own RED/GREEN/REVIEW cycle. |

## Session 15 outcome summary

### Closed via PR this session
- ✅ #34 EntuClient.get() throws-spec pin — squash `8861bfe`
- ✅ #37 i18n landing-page gap — squash `edacaa6`
- ✅ #25 packageManager pin — folded into `8b76af8`
- ✅ #24 README replace + #29 CONTRIBUTING.md follow-ups — squash `5b7a741`
- ✅ #50 OAuth init URL fix — squash `bc1d1a7` (live-test verified)
- ✅ #51 Entu auth URL shape fix — squash `63a4ce3` (live-test verified through sign-in)

### Filed this session
- 📝 #48 CHORE-48 linting setup (filed + landed install phase; still open as parent for #49)
- 📝 #49 CHORE-49 incremental rule enablement
- 📝 #50 CHORE-50 OAuth URL fix (filed + landed + closed)
- 📝 #51 CHORE-51 Entu auth URL shape (filed + landed + closed)
- 📝 #52 CHORE-52 EntuClient.search defensive throw (filed, open)
- 📝 #53 CHORE-53 BFF + IP-bound JWT arch decision (filed, open — headline for session 16)

### Live state at shutdown
- **Main:** `63a4ce3` (post-CHORE-51 merge); subsequent shutdown commit will be N+1
- **Deployment:** `2fca359a.multivox.pages.dev` (production alias)
- **`https://multivox.pages.dev/`** — HTTP 200, landing page from CHORE-35
- **`https://multivox.pages.dev/auth/login`** — HTTP 200, 6 provider buttons
- **OAuth sign-in:** verified working end-to-end (Smart-ID flow completes, JWT in cookie, signed-in landing renders)
- **`/api/organizations` (and any BFF data call):** 500 — see CHORE-52/53
- **Tests:** vitest 429/429, pnpm check 0, pnpm lint 0

### Team composition this session
- **finn** — 2 dispatches (linting config research + Entu /auth audit). Both delivered structured reports on time.
- **bentham** — 5 reviews (#34, #37, CHORE-48, docs bundle, #50, #51) + multiple stewardship calls + arch endorsements.
- **perotin** — 1 dispatch (credentials.env probe — should have been team-lead direct; lesson L58).
- **tallis** — 5 RED dispatches across the session (#34, #37, CHORE-48, docs bundle authored end-to-end, #50, #51). Consistent synthetic-violation discipline per L52.
- **josquin** — 9+ dispatches: GREEN phases for all six merges, all six squash-merges, two deploys (one with credentials-source workaround), live diagnostic for the 500.
- **comenius** — 1 dispatch (#37 i18n landing-page gap; 4-locale translation done).
- **byrd, victoria** — not spawned this session. Available next session if needed.

### Process notes from session 15 (also in `team-lead.md` L54-L60 and saved as memory notes)

- L54 — Entu IP-binding is documented design property (memory: `project_entu_jwt_ip_bound`)
- L55 — Audit-driven backlog sweep works as a single slate (cross-references `feedback_no_parallel_branches`)
- L56 — Doc-only PRs lite-path scales fine (extends prior L30)
- L57 — wrangler deploy auth via `CLOUDFLARE_API_TOKEN` env > OAuth (memory: `project_wrangler_deploy_auth`)
- L58 — Team-lead does single-shot probes directly (memory: `feedback_team_lead_direct_probes`)
- L59 — Sweep neighbors when pinning a defensive pattern (CHORE-52 = the sibling sweep we missed at CHORE-34)
- L60 — Live testing on deployed surface catches what no unit test can (CHORE-53 only surfaced this way)

(*MVOX:Palestrina*)
