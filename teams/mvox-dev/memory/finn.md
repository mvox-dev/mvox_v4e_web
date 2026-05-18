# Finn — Research Coordinator Scratchpad

## 2026-05-18 — First session of mvox-dev

### [CHECKPOINT] Audit completed

Full polyphony + D1 remnants audit delivered to team-lead. Key findings:

- `(*PD:Celes*)` on all 8 prompt files — not a current mvox-dev member, origin from polyphony-dev authorship
- `(*FR:Brunel*)` in `.claude/statusline-command.sh` — also not current member
- `prompts/josquin.md` has the most stale content (~25 findings): entire D1 safety rules section + all `apps/vault/`/`apps/registry/` paths
- `prompts/byrd.md`, `prompts/tallis.md`, `prompts/comenius.md` each have ~7-12 stale path references to `apps/vault/` and `apps/registry/`
- Stack table in `common-prompt.md` (L39-43) lists D1/BLOBs/EdDSA/Paraglide/Cloudflare as decided — FIXME marker present but rows read as authoritative
- ~~`.claude/statusline-command.sh` uses `/tmp/polyphony-test-status.txt` — needs rename~~ **FIXED** in session 1 round-2 patches; now uses `/tmp/mvox-test-status.txt`

### [PATTERN] Task routing

Tasks were routed to me via a "task-list" teammate ID that doesn't match the team-lead. Two tasks (Phase 6 ready message, CLAUDE.md patch) were not mine — correctly declined both and notified team-lead.

## 2026-05-18 — Session 2 context update

### [DECISION] Stack landed

- SvelteKit 2 + Svelte 5 Runes + TypeScript-strict + Tailwind v4, Cloudflare Pages + Workers
- Backend: Entu API (no own DB). Auth: Entu OAuth + BFF JWT httpOnly cookie
- i18n: Paraglide, locales en/et/lv/uk. Testing: Vitest + Playwright. pnpm, flat single-app
- Flat layout: `src/lib/`, `src/routes/`, `src/lib/server/` — no monorepo
- v4E schema source-of-truth: `~/projects/entu-research/docs/schema/v4E/`
- Case study (Entu integration patterns): `~/projects/entu-research/docs/case-studies/2026-05-polyphony-on-entu.md`
- Polyphony (`~/projects/polyphony/`) archived — reference only; D1/Registry/Vault patterns do NOT apply to mvox

### [GOTCHA] v4E formula rules (Bentham will RED violations)

1. Single-hop traversal only — no chained multi-hop forms
2. Output type: string or number only — not reference
3. Across rights boundaries: aggregates only (COUNT/SUM/etc.), never raw field projection

(*MVOX:Finn*)
