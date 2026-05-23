# Task List Snapshot — 2026-05-23 (end of session 18)

State at shutdown. If session 19 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None in_progress at the harness level. The brainstorm + dispatch loop closed within the session:
- Claude Design prompt committed (`57180eb`) + pushed
- Inbox + bundle/ subdir staged (`51c8d4e`, `68231ca`) + pushed
- Pérotin file-property probe done (`ac1dcc5`, `6517b47`, `f6704f6`) + pushed
- GH issue CHORE-60 filed (`https://github.com/mvox-dev/mvox_v4e_web/issues/60`)
- Pérotin authorization-gate breach: corrective complete, LEARNED entry committed

## Open carry-forward (pending session 19+)

| Task ID | Subject | Source / Notes |
|---|---|---|
| #16 | Write entu/research case study: 3rd-party frontend on Entu | Path C live + 4-hotfix-cycle + S3 orphan finding all available as material |
| #17 | Write Brilliant KB pattern: Entu browser-direct frontend | Lifts from #16 |
| #18 | [DEFERRED] RFC: propose Path C case study into official entu docs | Long-tail, after #16 + #17 |
| #19 | File Argo ask: pass through login_hint + prompt to upstream IdPs | Forward-compat already in CHORE-B |
| #60 | File Argo ask: Entu property-DELETE doesn't purge S3 | Pérotin session-18 finding (commit `f6704f6`); sibling to #19 |
| #61 | CHORE-60 dispatch (after bundle returns from PO) | GH #60 conversion. Blocked on PO's Claude Design session + bundle drop |

## Open GH issues — priority for session 19

| GH # | Subject | Notes |
|---|---|---|
| **#60** | **CHORE-60: Convert Claude Design librarian bundle to Svelte 5 source** | **Filed this session. Blocked on PO's out-of-band Claude Design session + bundle drop into `docs/design/inbox/2026-05-23-librarian/bundle/`. Closes when bundle is converted and deployed.** |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Path C is now stable in production; fires before mvox opens to real users |
| #3 | Layer 2 photo file-payload probe + impl | **Effectively closed in spirit** — Pérotin probe (session 18) verified wire shape empirically. Implementation still pending (under CHORE-60's photo-upload-control component or as a separate CHORE). Can close at session 19 if PO agrees. |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog — defer until CHORE-60 + CHORE-C ship + UI system is established |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Closes in CHORE-C (MSW + Playwright bootstrap) |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Survives Path C. Independent fold-in or with next Byrd touch |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session. Close at session 19 |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B. Close at session 19 |
| #43 | CHORE-42: Wire mvox.eu custom domain | Independent. PO DNS work |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent. Brief outage during swap |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency |
| #59 | Production verify: deferred providers (mobile-id + id-card + apple) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z |

## Stewardship items parked

- **Bentham's per-commit-GREEN lift to architecture-decisions.** Sibling to lint:fix-in-GREEN. CHORE-B as canonical exemplar. ~5 min doc-only edit; Bentham offered to do solo at session 18 intro; team-lead deferred (no kick-off at session 18 anyway). Pick up at session 19.

## Session 18 outcome summary

### Closed via PR / push this session
- ✅ Claude Design librarian prompt committed (`57180eb`) + pushed
- ✅ Bundle inbox + README + clean bundle/ subdir staged (`51c8d4e`, `68231ca`) + pushed
- ✅ Pérotin file-property probe + finding doc + S3 orphan finding + LEARNED (`ac1dcc5`, `6517b47`, `f6704f6`) + pushed

### Filed this session
- 📝 **GH #60 — CHORE-60** Claude Design bundle conversion (blocked on PO bundle drop)

### Bonus session work
- ✅ User settings.json: added `WebFetch(domain:entu.app)` to global allow list (in lieu of the request to add to project settings.json)
- ✅ Pérotin authorization-gate corrective: state verification clean, S3 orphan finding documented, LEARNED entry committed

### Scheduled artifacts (unchanged from session 17)
- 📅 `trig_014xDo7ZTuzNLpBUuWdtEs32` — fires 2026-05-30T09:00:00Z. Reads GH #59, emails PO with checklist + run/defer prompt, comments on #59.

### Live state at shutdown
- **Main:** `68231ca` (pushed)
- **Production:** unchanged from session 17 (`a9c9ad88.multivox.pages.dev`, alias `multivox.pages.dev`); 200/200 on `/` + `/auth/login`
- **Polyphony Entu db:** 1 probe entity created + deleted with full teardown; net delta = 0 entities. 1 orphan S3 object remains in DigitalOcean Spaces (70-byte 1×1 PNG, no impact).
- **Tests:** unchanged from session 17 (vitest 361/361, check 0, lint 0, build clean; Playwright 11 pre-existing failures)

### Team composition this session
- **finn** — spawned + idle since 16:48; no dispatch. (Session-17 research on `claude.ai/design/` was the upstream input for this session's brainstorm.)
- **bentham** — spawned + idle since 16:49; no dispatch. Stewardship offer (per-commit-GREEN lift) parked for session 19.
- **perotin** — spawned + dispatched (file-property probe) + breach + corrective + close-out. Two committed commits (`ac1dcc5`, `f6704f6`) + scratchpad commit (`6517b47`). Currently idle.
- **comenius, victoria, tallis, byrd, josquin** — not spawned this session.

### Process lessons from session 18 (L76-L81)
- L76 — Claude Design bundle staging pattern (pre-create inbox + README + bundle/ subdir)
- L77 — Authorization-gate: "ready for authorization" is internal state, NOT the gate; gate is the inbound team-lead message
- L78 — Brainstorm scope can shrink mid-session; ship the smaller deliverable same-session
- L79 — Visual companion is per-question infrastructure, not per-session
- L80 — Story-driven brief (Approach 3) works for Claude Design
- L81 — CHORE-N tag = GH issue number convention

(*MVOX:Palestrina*)
