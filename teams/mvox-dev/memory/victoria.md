# Victoria — Scratchpad

(*MVOX:Victoria*)

---

### [CHECKPOINT] 2026-05-18 — Task #5 revised draft delivered (PO review round 1)

PO approved F2, resolved F1+F3. Revised clean draft sent. Awaiting explicit PO go-ahead before `gh issue create`.

**Final breakdown (23 issues):**
- CHORE-1..6: bootstrap, Tailwind v4, Paraglide, Vitest/Playwright, BFF skeleton, email-sending capability (Resend/CF-compatible)
- A1, A2, A3: epic A (A4 ⚪ deferred to v2)
- B1, B2, B3, B4: epic B
- C1, C2, C3: epic C (C4 ⚪ deferred to v2)
- D1, D2: epic D
- ADMIN-1..5: season, event, invite member, rsvp policy, roster

**PO decisions (closed):**
- F1: A4 + C4 deferred to v2
- F2: B2 singer-only / ADMIN-3 admin-only split confirmed
- F3: Email via CF-Workers-compatible provider (Resend default); CHORE-6 added; PO creates DNS records (SPF+DKIM)

**Key facts:**
- PR #41 merged 2026-05-18 10:33Z — all 5 v4E additions live, no dependency tracking needed
- No 🔧 v4E additions needed for v1

**[GOTCHA]** `member.person.name` is a two-hop lookup. BFF must fetch `person` entities separately — not via formula chain (single-hop formula rule). Affects ADMIN-5 roster display.

**[DECISION] D1 AC:** No workspace switcher (Gap 2a). No notification feed in v1 (Epic E parked, Gap 2b). Explicit constraints in AC — not open questions.

**[DEFERRED]** Path B onboarding (singer-initiated application to org) — not in current issue set. B2 covers Path A (admin invite) singer side only. Raise with PO if v1 scope needs Path B.

**[PATTERN] AC template that worked well:**
- Lead with role + capability sentence
- Enumerate BFF query patterns (entity type, filter, rights tier)
- Explicit empty-state AC bullet (mandatory per Gap 4 / architecture decision)
- Vitest cases at the end with specific scenarios (boundary conditions, error paths named)
- Schema annotation (✅ / 🧩 / 🔧) on its own line at the end

### [CHECKPOINT] 2026-05-18 — Session 3 complete, all issues live

All 23 issues open on mvox-dev/mvox_v4e_web (#1–#23). Session ended cleanly after PO go-ahead.

**[DEFERRED]** A4 + C4 (attendance history, programme history) — parked ⚪, deferred to v2.

### [CHECKPOINT] 2026-06-01 — Session 28 complete, rehearsal-schedule first-slice issues filed

Design/mapping session for conductor/admin rehearsal-schedule slice. Spec approved at `4c4b1ab` (`docs/superpowers/specs/2026-05-31-rehearsal-schedule-first-slice-design.md`).

**Issues updated/filed:**
- #19 ADMIN-1 (create season) — AC replaced with spec §7 Cap 1
- #20 ADMIN-2 (create event) — scoped to rehearsal series only, triggers #81
- #81 ADMIN-6 (generate event instances eager) — NEW; DST regression test required
- #82 ADMIN-7 (view rehearsal list) — NEW; conductor primary screen at `/seasons?season=<id>`
- #83 ADMIN-8 (cancel/edit single instance) — NEW; gating probe §8 #1 (delete rights)
- #84 ADMIN-9 (delete series cascade) — NEW; gating probe §8 #1 (delete rights)
- #85 ADMIN-10 (assign/manage season conductors) — NEW; gating probe §8 #4 (grant wire + inherited flag)

**[GOTCHA] Cap 7 gating probes — must resolve before GREEN on #83/#84/#85:**
- Probe §8 #1: Pérotin confirms DELETE is `_owner`-tier on live playground
- Probe §8 #4: does `inherited: true` appear on cascaded rights in season GET? (if absent → AC5 list-conductors needs fallback: subtract org `_owner` person-ids from season `_editor` list); also: grant/revoke wire shape; creator-auto-`_owner` mechanic

**[PATTERN] Cap 7 roles-as-rights:** conductor = direct `_editor` grant on season; no `conductors` property; list = entries without `inherited: true` flag; display name via separate `GET /entity/{personId}` (same as ADMIN-5 pattern).

**[DEFERRED]** Pure-conductor delete rights — conductor-only persona (no org `_owner`) cannot cancel rehearsals (DELETE is `_owner`-tier). Needs PO decision: grant `_owner` on season (scoped), or BFF elevated-op. Surface when pure-conductor persona becomes real.

(*MVOX:Victoria*)
