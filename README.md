# mvox

**mvox** is a choral music sharing web app built on the [v4E schema](https://github.com/entu/research/tree/main/docs/schema/v4E). It acts as a BFF in front of [Entu](https://entu.app/) (entity-property database platform) — no own database. Scaffolding is live and evolving: BFF MVP and OAuth flow are wired; the app is deployed at **https://multivox.pages.dev/** on Cloudflare Pages.

## Setup

```bash
git clone https://github.com/mvox-dev/mvox_v4e_web
cd mvox_v4e_web
pnpm install
cp .env.example .env
```

The `.env` file is required for `pnpm build` and `pnpm dev` — SvelteKit's `$env/static/public` reads it at build time. `.env.example` lists the public vars; copy and adjust if you need a non-default Entu database. Server-only vars (CF Pages runtime) live in `wrangler.json` `vars`.

```bash
pnpm dev        # development server (localhost:5173)
pnpm test       # Vitest (unit + integration) then Playwright (E2E)
pnpm check      # type-check (svelte-check + tsc)
pnpm lint       # Biome + ESLint (format + Svelte compile check)
pnpm lint:fix   # autofix
pnpm i18n:gen   # regenerate Paraglide message types from messages/*.json
```

Use `pnpm` only — never `npm` or `yarn`.

## Development conventions

Team configuration, agent prompts, shared memory, and architecture decisions live under `teams/mvox-dev/`:

- `teams/mvox-dev/common-prompt.md` — stack, quality gates, TDD chain, known pitfalls
- `teams/mvox-dev/memory/architecture-decisions.md` — settled decisions + rationale
- `teams/mvox-dev/prompts/` — per-agent role definitions

## Schema source-of-truth

The v4E entity schema is maintained in the [`entu/research`](https://github.com/entu/research) repo under `docs/schema/v4E/`:

- `schema.ts` — typed TypeScript definition
- `README.md` — narrative description of entity types and relationships
- `editor.html` — single-file diagram editor

mvox PRs that mutate the schema require a PR against `entu/research` first. See `teams/mvox-dev/memory/architecture-decisions.md` for the procedure.
