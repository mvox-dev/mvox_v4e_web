# Task List Snapshot — 2026-05-22 (end of session 12)

State at shutdown. If session 13 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 14 | DEFERRED: Layer 2 file-payload probe + instance migration impl | pending | — | Empirical probe: does Entu's POST-with-file-fields re-link to a pre-existing S3 object after DELETE of previous property value, or does it require fresh upload? Probe answer determines whether file-property rename is doable as DELETE-then-POST or requires download-via-signed-URL + re-upload. After probe: implement Layer 2 of the photo-rename cleanup with correct file-value round-trip + extend EntuProperty type (YELLOW-12.2) + widen probe-rename-photo-impact to capture all file-value fields (YELLOW-12.1). **Fires only if:** (a) someone uploads an `avatar`/`logo` instance value before Layer 2 lands, OR (b) BFF needs `_thumbnail` working on real data with uploaded files. |

All session-12 active work (tasks #9, #10, #11, #12, #13, #15) closed in this session.

Session-11 carryforwards that did NOT come up in session 12 (still applicable for future sessions, all filed as GH issues this session):

| GH # | Subject | Notes |
|---|---|---|
| #6 | CHORE-6 — Email Resend wiring | Blocked on PO SPF + DKIM DNS records on chosen sender domain. Re-check next session start. |
| #29 | docs: CONTRIBUTING.md follow-ups (+YELLOW-3.2 commit-body convention) | Low priority. YELLOW-3.2 folded in as comment AC bullet this session. |
| #30 | YELLOW: CSRF gate at first cookie-authed BFF mutation route | Fires on first cookie-authed mutation route PR. |
| #31 | YELLOW: relax CHORE-2 OKLCH color regex on next Tailwind upgrade | Fires on next `tailwindcss` minor/major bump. |

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Session 12 outcome summary

- ✅ **Carryforward sweep** — all session-11 carryforwards addressed:
  - Task #3 → anthropics/claude-code#61315 (sub-agent perm-gate upstream report, cross-linked to #47339, #32402, #38859, #51288, #56686, #57037)
  - Task #5 → GH #29 extended with YELLOW-3.2 commit-body AC bullet
  - Gated YELLOWs → GH #30 (CSRF) + GH #31 (OKLCH) filed with explicit fire-when triggers
- ✅ **BFF design review** — Q1-Q5 walked + locked; design doc APPROVED status; merged to mvox main at `e42cb1e`
- ✅ **entu/research PR draft** — paste-ready finding doc `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md` merged to main; PO submits upstream out-of-band
- ✅ **Photo-rename pre-stage** — Pérotin Layer 1 cleanup script on `chore/perotin-rename-photo-prestage-2026-05-21` @ `ea1a2b1`; Bentham GREEN; 2 prop-def renames planned, 0 instance migrations today; live-gated on upstream merge + PO "I authorize"
- ✅ **Layer 2 deferred to task #14** — file-payload probe + impl gated on empirical question (Entu file-POST re-link semantics)

### Forward-looking work unblocked for session 13

- **entu/research PR status check** — first action of session 13. If merged, capture SHA + route Pérotin live. If not, pivot.
- **First BFF impl PR** (gated on rename landing both upstream + on polyphony db) — Tallis RED → Josquin GREEN → Bentham → Josquin merge for the 2-GET MVP. MUST carry `Schema-Change:` + `PO-Approved:` trailers.
- **Byrd frontend scaffolding** — can run parallel to BFF impl; mocked endpoints until impl lands.

### Team composition this session

All 4 spawned agents performed cleanly. No spawn failures, no perm-gate stalls (workaround held).
- **finn** — 2 research tasks: (1) upstream perm-gate prior art (delivered 94-issue audit + cross-links), (2) Entu native file-URL mechanism + `picture` vs `logo` (delivered the `_thumbnail` hardcoded-to-`photo` finding that drove Q5)
- **bentham** — 2 reviews: (1) Pérotin photo-rename pre-stage RED-1 (caught Layer 2 file-payload bug; "split-by-blast-radius" calibration), (2) re-review GREEN
- **perotin** — 2 dispatches: (1) Layer 1 + Layer 2 pre-stage (RED'd on Layer 2), (2) RED-1 fix via Option A split (GREEN)
- **josquin** — 1 dispatch: finalize BFF design doc + draft entu/research PR (clean delivery; called out the build-schema regen open question correctly)

## Repo state at shutdown (session 12)

- **Branch:** `main` at `e42cb1e` (pushed)
- **Side branch:** `chore/perotin-rename-photo-prestage-2026-05-21` at `ea1a2b1` (pushed, NOT merged; awaiting upstream + auth)
- **Working tree:** memory file mods staged for shutdown commit (this snapshot + team-lead seed)
- **All session-12 active work pushed** to origin

### Session 12 commit chain on main (chronological)

1. `e42cb1e` docs(bff): rights-aware contract design + entu/research rename PR draft (squashes branch `docs/bff-rights-design` including Josquin's session-11 design + session-12 PO decisions + paste-ready entu/research PR draft + build-schema regen language polish)
2. (this session's shutdown commit — final commit of session 12)

Plus on side branch:
- 4 commits on `chore/perotin-rename-photo-prestage-2026-05-21` ending at `ea1a2b1` (photo-rename pre-stage, Bentham GREEN)

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 12:** none (no GH issues touched closure this session — all work either on docs branch or out-of-band)
- **Opened in session 12:** #30 (CSRF gate), #31 (OKLCH regex)
- **Commented in session 12:** #29 (added YELLOW-3.2 AC bullet)
- **Open issues:** #6 Email, #7-#18 user stories, #19 ADMIN-1 season, #20-#23 admin stories, #24 README rewrite, #25 packageManager pin, #29 CONTRIBUTING follow-ups, #30 CSRF gate, #31 OKLCH regex

### External issues filed this session

- **anthropics/claude-code#61315** — sub-agent permission-gate silent-block. Cross-linked to 6 related open issues. Class is accumulating reports with no visible fix momentum; mitigation stays: keep sub-agent work to non-gated tools.

## Polyphony Entu db state at shutdown (session 12)

**UNCHANGED from session 11** (no live mutations executed this session; rename pre-staged but not run).

- **person:** 122 instances (2 real + 120 v4E-clean seeds). 0 with `avatar` value set.
- **organization:** 6 instances + 1 TYPE entity, all `_inheritrights=false`. 0 with `logo` value set.
- **affiliation / inventory_copy / participation / role:** still retired (0 instances).
- **menus:** 24 total (unchanged).
- **`person.avatar` + `organization.logo` prop-defs:** still present (rename pre-staged, gated on upstream merge + auth).

## External artifacts created this session

- `docs/architecture/bff-rights-aware-contracts.md` — design doc updated to APPROVED status (merged to main)
- `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md` — entu/research PR draft (merged to main, paste-ready for upstream)
- `scripts/migrations/probes/probe-rename-photo-impact-2026-05-21.ts` (on side branch)
- `scripts/migrations/cleanup-rename-photo-prop-def-only-2026-05-21.ts` (on side branch; supersedes the original combined script which was deleted on the branch per Option A split)
- `scripts/migrations/seed-results/probe-rename-photo-impact-*.json` (probe artifact, on side branch)
- `scripts/migrations/seed-results/cleanup-rename-photo-prop-def-only-2026-05-22T00-02-52-348.json` (dry-run artifact, on side branch)
- GH issues #30 + #31 (filed)
- anthropics/claude-code#61315 (filed)
- Multiple scratchpad updates: `team-lead.md` (this session), `bentham.md` (RED + GREEN review notes, "split-by-blast-radius" pattern), `perotin.md` (photo-rename pre-stage notes), `josquin.md` (BFF design finalize notes)

(*MVOX:Palestrina*)
