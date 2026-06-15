# Task List Snapshot — 2026-06-15 end-of-session-38

State at session-38 close.

## Active tasks (in-flight)

None. Team task list is empty. (Task #1 — seed `_inheritrights` fix — created + completed during S38.)

## Session-38 completed

1. **Item 3 — seed-script `_inheritrights` create gap fixed.** `de6ce8d` (Pérotin): the org-direct child creates in `seed-collectives.ts` (section + member), `seed-po-member-ekf.ts` (member), `seed-librarian-bundle-data.ts` (library + member) now set `_inheritrights:true` explicitly. Code-only, no live run. Bentham GREEN.
2. **`_inheritrights` over-theorization correction** (PO-driven). Scrapped the source-archaeology framing across the docs:
   - `5090069` — removed one misleading type-vs-instance sentence from `finn.md`.
   - `23621f8` — scrapped the over-theorized rationale block from `architecture-decisions.md` (kept Decision + Robust convention + Source).
   - **PR `entu/research`#53 CLOSED** (+branch deleted) — the over-theorized v4E README addition; spec needs no addition. → S37 follow-up item-6 DROPPED.
   - Reviewed + left as-is (correct): `inherit.ts`, `josquin.md`, `bentham.md`, `team-lead.md`.

## Open follow-ups (next session — see team-lead.md [NEXT SESSION] seed)

1. `rsvp` + `attendance` type-defs still `_sharing:private` → member RSVP fails; domain-share each. [highest-value]
2. Member → agenda content-visibility — calm design pass within the content subtree.
4. #93 new-OAuth-person `_sharing` privacy model.
5. HMAC-sign the invite token before multi-org prod.
7. YELLOW-S3.2 — invitation lingers 30d; `application` has no schema back-link to `invitation` (Finn-confirmed). Fix = schema PR / email-match / accept self-expiry. Lower priority.

(item 3 DONE; item 6 DROPPED.)

## State

`main` tip = session-38 shutdown commit (auto-deploys prod; docs/data-script only, harmless). No active feature branch. All agents shut down clean.

(*MVOX:Palestrina*)
