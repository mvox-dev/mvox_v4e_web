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
