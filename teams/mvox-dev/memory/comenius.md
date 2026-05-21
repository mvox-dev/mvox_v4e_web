# Comenius — i18n Specialist Scratchpad

Personal notes. Only Comenius writes here. Keep under 100 lines; prune stale entries.

Tags: `[DECISION]`, `[PATTERN]`, `[WIP]`, `[CHECKPOINT]`, `[DEFERRED]`, `[GOTCHA]`, `[CONVENTION]`, `[TRANSLATION]`

---

## Seed — 2026-05-20 (created by Medici, FR audit)

Scratchpad seeded as part of the FR knowledge-health audit. Comenius is a new permanent member (PO promotion at session-7-end alongside Pérotin); the prompt expected a scratchpad at this path but the file was missing. Stub created here so first-spawn Comenius doesn't have to construct the file from scratch.

### What to read first

- `common-prompt.md` — team-wide standards, Stack table (Paraglide row), startup read-list (you're in the all-roles + comenius-specific rows)
- `memory/architecture-decisions.md` — settled patterns (especially the i18n locale list: en/et/lv/uk)
- `prompts/comenius.md` — your role-of-record

### Companion shared file (you steward this)

- `teams/mvox-dev/memory/i18n-conventions.md` — naming rules, tricky translation choices. **Does not exist yet** — create it on your first i18n task, not at intro. Format: naming convention rules at the top, per-key translation decisions appended below.

### First-task expectation

CHORE-3 (#3) Paraglide i18n is on the carry-forward task queue for session 8 (per `team-lead.md`). Open AC decision: gitignore vs commit `src/lib/paraglide/` — your call on first spawn, recommend `.gitignore`-it (generated artifact; Paraglide standard).

(*FR:Medici* — seed entry; Comenius rewrites/replaces on first real session)

---

## Session 10 — CHORE-3 AC research (2026-05-21)

[CHECKPOINT] First real Comenius session. Delivered gitignore-vs-commit AC recommendation to team-lead via SendMessage.

### Findings

[DECISION] `src/lib/paraglide/` should be **gitignored**, not committed.

Key evidence:
- Paraglide compiler option `emitGitIgnore` defaults to `true` — it auto-writes a `.gitignore` inside the output dir on every compile. Committing the output requires explicitly overriding this with `emitGitIgnore: false`, which goes against Paraglide's own intent.
- The `paraglideVitePlugin` (used in `vite.config.ts`) regenerates the output dir on every `pnpm dev` and `pnpm build`. Cloudflare Pages runs `pnpm build`, so CI is covered without a separate compile step.
- No drift risk: generated output always reflects current `messages/*.json`.
- Zero PR noise: generated TS never appears in diffs.

`.gitignore` line to add:
```
src/lib/paraglide/
```

[GOTCHA] `pnpm check` (`svelte-check`) runs outside Vite and needs the generated types to exist. In a fresh CI checkout with no prior build, `pnpm check` will fail if `src/lib/paraglide/` is absent. Fix: ensure `pnpm build` runs before `pnpm check` in CI, OR add a `postinstall`/`prepare` script that runs `paraglide-js compile`. Deferred to CHORE-3 implementation — Tallis should verify how CI is structured before adding the hook.

[DEFERRED] Second-order questions sent to team-lead for resolution at CHORE-3 implementation time:
1. Does Cloudflare Pages CI run `pnpm check` separately or only `pnpm build`?
2. Exact package: `@inlang/paraglide-sveltekit` (per AC) vs `paraglideVitePlugin` from `@inlang/paraglide-js` — policy is the same either way.
3. Confirm `emitGitIgnore: false` is NOT set in the Vite config (default true reinforces the gitignore policy).

(*MVOX:Comenius*)
