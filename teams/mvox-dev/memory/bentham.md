---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-18 — Session 2: stack landed, calibration reset

[DECISION] Stack confirmed (see `common-prompt.md` Stack table and `architecture-decisions.md` "Stack" entry): SvelteKit 2 + Svelte 5 Runes + Tailwind v4 + Paraglide (en/et/lv/uk) + Cloudflare Pages/Workers via `@sveltejs/adapter-cloudflare`, Entu API backend (no own DB), Entu OAuth + httpOnly JWT cookie BFF, pnpm (no workspaces), flat single-app layout. Every row in the table is now an enforceable RED trigger when violated.

[DECISION] **Repo layout is flat single-app**, NOT monorepo. `src/lib/`, `src/routes/`, `src/lib/server/`. No `apps/` or `packages/`.

[DECISION] **Flag #4 CLOSED.** v4E schema-mutation gate adopted as Option A (trailers on the mvox PR). PO confirmed verbal-in-session approval is acceptable evidence as long as team-lead logs it with timestamp. Rule lives in `common-prompt.md` (Known Pitfalls / v4E Schema Mutations) and `architecture-decisions.md`. My job: RED any mvox PR that touches v4E entity types/properties/formulas/rights defaults without both trailers.

[PATTERN] **Security-critical paths now concrete** (per updated prompt): `src/lib/server/entu/`, `src/lib/server/auth/`, `src/hooks.server.ts`, `src/routes/api/**`, `src/routes/**/+server.ts`, `src/routes/**/+page.server.ts`. Old polyphony shapes (`apps/vault/`, `apps/registry/`, `packages/shared/crypto/`) are dead — purge from mind.

[PATTERN] **v4E RED triggers** distilled from case study (Sections B, D) — encoded in my prompt "What to Watch For / v4E / Entu":
  1. Multi-hop formulas (anything beyond single hop or `_parent`) — silently absent → RED
  2. `type: reference` on formula property — silently coerces to string → RED (declare as `type: string`)
  3. Formula projecting raw values across rights boundaries (CONCAT names, descriptions) — leak; only aggregates (COUNT/SUM/AVG/MIN/MAX) are safe across boundaries → RED
  4. New BFF route running in elevated mode without entry on the enumerated elevated-ops list → RED
  5. Granting `_owner`/`_editor`/`_viewer` on org-subtree entity without active `member` for that person in that org → RED
  6. Direct calls to `https://entu.app` from client code → RED (all calls go through BFF)
  7. Splitting/flipping a `_inheritrights: false` boundary without a v4E schema change → RED (rights islands are load-bearing)

[PATTERN] **Per-value `_sharing` warning DROPPED** per PO calibration. Don't add it to the checklist; PO judged it not worth the context space. Single-hop formula rule + the seven above stay.

[PATTERN] Elevated-ops list in `architecture-decisions.md` is seeded EMPTY. Don't auto-inherit polyphony's list (cron cleanup, federation reports, email self-link); evaluate per op as they emerge. New entries require team-lead approval.

## Open items I'm watching

[DEFERRED] No `test-gaps.md` yet — Tallis appends as gaps emerge. Will read when it appears.

[DEFERRED] No code in the repo yet. First PRs (likely auth/OAuth + first BFF endpoint) will be the calibration test for the security-critical-paths rules. Watch for: missing `httpOnly`/`Secure`/`SameSite` on the JWT cookie, missing CSRF protection on POST endpoints, client-side env vars leaking secrets via `$env/dynamic/public`, and unsafe URL composition in BFF passthrough.

[CHECKPOINT] Calibration state for session 3+: stack table enforceable; v4E RED triggers from case study Sections B + D encoded; flag #4 closed; per-value `_sharing` dropped; elevated-ops list empty; awaiting first PR.

(*MVOX:Bentham*)
