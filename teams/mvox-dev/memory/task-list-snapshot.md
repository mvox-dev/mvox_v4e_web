# Task List Snapshot — 2026-08-06 end-of-S42 (CHECKPOINT)

Session-scoped local task list was cleared mid-session (known quirk); GitHub issues are the canonical task state. This snapshot mirrors Slice-4 (#21) task status for next-session restore. **NEXT SESSION: ultracode the remaining build wave.**

## Slice-4 Onboarding (#21) — task board

### DONE (foundation, merged to main @ 7838989)
- **T4.1 → #22 CLOSED** — remove `add_user` from polyphony db entity (live mutation; Mihkel consent + team-lead per-run verify; AC2 DB-read).
- **T4.2 → #23** (needs-po) — invite-binding report: TOKEN-POSSESSION (bearer link). Report delivered.
- **T4.3 → #24 CLOSED** — schema: `profile` type live `6a74933f…817` (public, name+email children); `person` reduced (name/email/notes removed, 18 remain, stays domain). No data loss.
- **T4.4 → #25 CLOSED** — single create path `createProfile` (`src/lib/profile/profileData.ts`) merged `7838989`; type-level non-omittable `_inheritrights:false`+`_sharing`, `_owner` grant, fail-loud, sole-path guard. Bentham GREEN.

### REMAINING (ultracode next session) — cut, unlabeled/held
- **T4.5 → #31** — invite: admin creates person+member, generates invite, unauthed `/invite/` landing (guard.ts:43). Needs T4.2✓+T4.3✓ (UNBLOCKED, next; closes no-new-person window). Design decision: reconcile the pre-existing `/invite/[token]` slice-3 page (read: REPLACE).
- **T4.6 → #26** — profile edit UI: fields per level, lazy create on first save via createProfile, honest round trips. Needs T4.4✓+T4.3✓+a member (T4.5).
- **T4.7 → #27** — visibility moves: create-before-delete, narrower-wins, two-lit ACTIVE repair path. Needs T4.4✓+T4.6.
- **T4.8 → #28** — empty-profile fallback (display-name decision pending). Needs T4.3✓.
- **T4.10 → #30** — migration: name×131/email×2 move into profile entities via createProfile, grant member _owner, loud per-record. Needs T4.4✓+T4.3✓ + 128-singers scope decision.
- **T4.9 → #29** — deploy + live gate: admin cannot read private profile entity (non-empty + positive control). Last.

## Open PO decisions (non-blocking to start T4.5)
1. T4.5 old-`/invite/[token]`-page reconciliation direction (team-lead read: REPLACE with native flow; bearer-link handling).
2. Display-name field on `person` vs drop empty-profile fallback.
3. T4.10 — do the 128 synthetic public singers get profile entities?

## Carry
- YELLOW-T4.4.1: downstream reviews verify each create funnels through `createProfile`, not merely that `_inheritrights` appears.
- Residual exposure: ~15 `person` fields (idcode/birthdate/address/…) stay domain-readable by members — NOT closed by this slice (on #21). Never describe as handled.

(*MVOX:Palestrina*)
