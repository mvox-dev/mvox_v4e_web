---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-18 — First session calibration

[DECISION] Stack table in `common-prompt.md` is **inherited from polyphony, UNCONFIRMED**. Only `pnpm` is enforceable. Do NOT RED a PR for violating D1/BLOBs/EdDSA/Paraglide/Tailwind/SvelteKit rules until PO confirms each row.

[DECISION] Security-critical file paths in my prompt (`apps/vault/`, `apps/registry/`, `packages/shared/crypto/`, `apps/vault/migrations/`) are polyphony-shaped and **do not apply** to mvox. Until real paths land, apply the kept rule: **anything touching auth, permissions, or external input is security-critical regardless of path**.

[DECISION] Legal compliance bullet about "invite-only vault enforcement" is FIXME — access model is TBD. Do NOT RED for missing vault/invite checks. Re-evaluate when PO defines mvox access model (likely Entu permissions, not vault invites).

[DECISION] D1 migration safety patterns (`_new` table, parent-first drops, junction handling) do NOT apply — mvox has no D1, it's an Entu BFF. Do NOT RED on those.

[DECISION] Author trailer is `(*MVOX:Bentham*)`, not `(*PD:Bentham*)`. PD = Polyphony-Dev; all repo files have been flipped.

[PATTERN] Josquin's prompt has been heavily FIXME'd — Auth Architecture (Registry/Vault/JWKS), D1 Critical Safety Rules, Core Responsibilities, WRITE/READ list, Key Paths. When reviewing his first PR, calibrate against "Entu BFF caller" not "D1 + JWKS author".

[PATTERN] Tallis's prompt: D1Database mock removed; auth mock pattern TBD. Don't expect (or require) those test patterns until Tallis re-establishes them.

## Open items I'm watching

[DEFERRED] **Schema-migration PO-approval gate (flag #4)** — mechanism not formalized. When any agent touches `~/projects/entu-research/docs/schema/v4E/` (`schema.ts`, narrative `README.md`, `editor.html`), RED any PR that lacks recorded PO approval. Team-lead is aware.

[DEFERRED] **TDD ownership table refs missing dirs (flag #3)** — `packages/shared/`, `migrations/` in `common-prompt.md` ownership table. Passive watch; will resolve when repo structure lands.

[DEFERRED] **Real security-critical paths for mvox** — once Entu integration lands, ask team-lead to update `prompts/bentham.md` "Security-Critical Files" with actual paths (likely `src/lib/server/entu/`, `src/lib/server/auth/`, wherever Entu client + JWT verification live).

[GOTCHA] Memory dir was empty at session start — no scratchpad, no `architecture-decisions.md`, no `test-gaps.md`. I steward `architecture-decisions.md`; create it on first real architectural decision, not preemptively.

(*MVOX:Bentham*)
