# Task List Snapshot — 2026-06-15 end-of-session-37

State at session-37 close.

## Active tasks (in-flight)

None. Session wrapped. (Team task list is empty — the session's chain tasks were created + completed/cleared during S37.)

## Session-37 completed

1. **Slice-3 invite/join (native keyless) — SHIPPED to prod.** Full TDD chain (Tallis RED → Josquin GREEN data → Byrd GREEN UI → Comenius i18n → Bentham GREEN), + a soft-close fix (`_editor` can't delete entity, so approve sets `status:'approved'`), + userStore owner-wins fix, + SSR-safety fix + Playwright guard. Merged `7b2aa1b` (Closes #21 / #11 / #91). PO click-tested end-to-end on live polyphony. Gist: https://gist.github.com/mitselek/9b838b01fe7a91399324b1828e801859
2. **`_inheritrights` rights-model:** rule documented (architecture-decisions.md 2026-06-15); create helpers fixed in code (`6e583d8`, `src/lib/entu/inherit.ts`); live EFK data aligned (org false, children true).
3. **Deployment prerequisites applied to polyphony:** `add_user` on db entity; `application`/`invitation`/`member` type-defs → `_sharing:domain`.
4. Probes/findings committed to main (LIST-visibility #92 GREEN, `_editor` rights table, membership-content-visibility model).

## Open follow-ups (next session — see team-lead.md [NEXT SESSION] seed for detail)

1. `rsvp` + `attendance` type-defs still `_sharing:private` → "Couldn't save RSVP" for members; domain-share them.
2. Member → agenda content-visibility design (within the content subtree, never flip the org). Confirm whether the member sees the agenda post-revert.
3. Seed scripts (4) `_inheritrights` create gap (Pérotin — import `inherit.ts` lookup).
4. #93 new-person `_sharing` model (PO/Victoria).
5. HMAC-sign the invite token before multi-org prod.
6. Mirror the `_inheritrights` rule into the v4E README (`entu/research`).
7. Slice-3 YELLOW-S3.2: carry `invitationId` to approve so the invitation is deleted (currently self-expires).

## State

`main` tip = `6e583d8` (auto-deploys prod). No active feature branch. Slice-3 done; #21/#11/#91 closed. All agents shut down clean.

(*MVOX:Palestrina*)
