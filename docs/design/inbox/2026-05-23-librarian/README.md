# Claude Design bundle — librarian view (2026-05-23)

**What this is:** Staging area for the Claude Design output that returns from the session driven by `docs/superpowers/specs/2026-05-23-claude-design-librarian-prompt.md`. Created empty by the team-lead before the out-of-band session; PO drops the bundle files here.

## What goes in this directory

Whatever Claude Design's "Send to Claude Code" handoff produces. Per Finn's session-17 research, expect:

- `tokens.json` — the design-system tokens (color, type, spacing, radius, shadow scales)
- `guidelines.md` — the design-language narrative (state rules, component conventions, voice)
- Component HTML files — extracted reusable parts (e.g., `button.html`, `card.html`, `list-row.html`)
- Page HTML — the chosen variant (probably `index.html` or `librarian.html`)
- A CSS file or stylesheet bundle
- Optionally: screenshots of the 3 variants, PO's notes on which one was picked + why

Subdirectory organization is up to PO — Claude Design may emit a flat bundle or a structured one. Either works.

## What the next Claude Code session does

The new session reads this directory + the source prompt + the mvox project CLAUDE.md, then converts the bundle to Svelte 5 + Tailwind v4 source. Expected output:

- `src/lib/components/` — extracted Svelte components (typed props, Runes, accessibility primitives)
- `src/routes/library/+page.svelte` — the librarian page wired up against Path C (browser-direct Entu)
- `src/app.css` extension — Tailwind v4 `@theme` block hydrated from `tokens.json`
- Tallis spec files for the components (RED before GREEN per team TDD chain)
- Comenius i18n keys for any UI labels the bundle exposes in English

The conversion is a Byrd-via-Claude-Code task on a feature branch (`feat/library-design-impl` or similar). Tallis writes spec files, Byrd writes the Svelte components, Comenius adds i18n keys, Bentham reviews. Standard TDD chain.

## Pointer to upstream

- **Source prompt:** `docs/superpowers/specs/2026-05-23-claude-design-librarian-prompt.md`
- **Persona:** librarian (action-heavy, expert)
- **Page:** library / score browsing
- **v4E schema entities involved:** `work`, `edition`, `copy`, `lending`, `member`
- **Architectural constraint:** browser-direct Entu (Path C, live on production since `fc99291`) — no BFF data proxy

## When this directory can be deleted

After the bundle has been converted to Svelte source AND the conversion has landed on main (via PR). Keep the bundle through the review cycle so reviewers can cross-reference; archive or delete once landed.

(*MVOX:Palestrina*)
