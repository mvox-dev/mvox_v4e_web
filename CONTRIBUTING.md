# Contributing to mvox

## Setup

See `README.md` for the full environment setup. You'll need `pnpm` — never `npm`.

## Testing

mvox uses [Vitest](https://vitest.dev/) for unit and integration tests and [Playwright](https://playwright.dev/) for E2E.

### Test layout

| Type | Location | Pattern |
|---|---|---|
| Unit | colocated with source | `foo.ts` → `foo.spec.ts` |
| Integration | `src/tests/` | route + Entu client mock |
| E2E | `tests/` (repo root) | Playwright spec |

**Unit tests** live next to the file they test. Example:

```
src/lib/server/entu/client.ts
src/lib/server/entu/client.spec.ts
```

**Integration tests** (`src/tests/`) cover SvelteKit route handlers combined with a mocked Entu client — no live network calls, no browser.

**E2E tests** (`tests/`) run via Playwright against a local preview server (`pnpm preview`).

### Commands

```bash
pnpm test          # Vitest (unit + integration) then Playwright (E2E)
pnpm test:unit     # Vitest only
pnpm test:e2e      # Playwright only
pnpm check         # Type-check (svelte-check + tsc)
```

### Config files

- Vitest: `vitest.config.ts` — includes `src/**/*.spec.ts` and `scripts/**/*.spec.ts`
- Playwright: `playwright.config.ts` — `testDir: ./tests`, boots `pnpm preview` on port 5173

### Patterns

**Entu client mock** — BFF route tests mock the Entu client at the module boundary:

```ts
import { vi } from 'vitest';
vi.mock('$lib/server/entu/client');
```

This is the standard pattern for `src/tests/` integration tests. Do not make real HTTP calls to Entu in tests.

**No D1 mocks** — mvox has no Cloudflare D1. If you encounter `createMockDb()` it is a polyphony carry-over and should be removed.

**Dynamic imports in specs** — when a test needs to control env vars or global stubs before a module loads, use `await import(...)` inside the `it()` body rather than a top-level import. This avoids module-caching issues.

### TDD chain

Tests come **before** implementation. The full chain:

1. **Tallis** writes failing tests (RED) — `*.spec.ts` colocated with source, `tests/` for E2E
2. **Byrd + Josquin** make them pass (GREEN) — Josquin implements API/BFF, Byrd implements UI
3. **Comenius** adds i18n strings
4. **Bentham** reviews (RED / YELLOW / GREEN verdict)
5. **Josquin** squash-merges after Bentham GREEN

See `teams/mvox-dev/common-prompt.md` for the full ownership chain and handoff format.

## PR submission

### Branch naming

Use the prefix that matches the squash commit type:

- `feat/<issue>-<short-slug>` — new feature
- `fix/<issue>-<short-slug>` — bug fix
- `chore/<issue>-<short-slug>` — housekeeping, tooling, docs

### Commit message format

```
feat(#NN): short description

Longer body if needed.

Closes #NN
```

The issue number is mandatory when a GitHub issue exists. Use `Closes #NN` when the squash-merge should close the issue, or `Refs #NN` when the issue is a parent of multi-PR work and should stay open.

### Co-author trailer

All commits should carry:

```
Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>
```

On dev machines this is added automatically by the `prepare-commit-msg` hook — no manual step needed. If you commit from an environment without the hook, add it manually.

### Gates before opening a PR

All three must exit 0:

```bash
pnpm check      # type errors
pnpm test       # unit + integration + E2E
pnpm lint       # format + Svelte compile check
```

### CLI-generated auxiliary files

When a CLI tool (e.g. `paraglide-js init`, `pnpm dlx some-init`) generates additional config files alongside the requested artifacts, enumerate them in the commit body so reviewers can confirm the scope without re-running the CLI. Example: if `paraglide-js init` creates `project.inlang/.gitignore` and `project.inlang/project_id` alongside `project.inlang/settings.json`, list all three. This reduces reviewer burden and surfaces tool side-effects. (Precedent: CHORE-3 commit `7bf0d8f`.)

## Code style

**Svelte 5 runes only.** Use `$state`, `$derived`, `$effect`, `$props`, `$bindable`. Never use legacy `export let` or `$:` reactive syntax.

**Server boundary.** Code that must not run in the browser belongs under `src/lib/server/`. Never import server modules in client code.

**TypeScript strict mode.** `compilerOptions.strict: true` is enforced in `tsconfig.json`. Do not loosen it.

**Tailwind: full class names only.** Do not build class names with template literals (e.g. `` `text-${color}-500` ``). Tailwind's tree-shaker scans source statically and cannot resolve dynamically constructed names.

**Author attribution.** Persistent text output — architecture decisions, PR descriptions, scratchpad entries, memory files — should carry a `(*MVOX:<Name>*)` trailer identifying the author.

**v4E formula constraint — single-hop only.** Formula traversal supports `propertyName.*.property` and `_parent` but not chained forms such as `ref.*._parent.*.name` — chained forms silently return absent. Denormalize via intermediate single-hop formulas. (v4E spec case study D1, D3.)

**Linting.** `pnpm lint` runs Biome and ESLint in sequence. Biome owns formatting and minimal lint rules on `.ts`, `.js`, and `.json` files. ESLint is scoped to `.svelte` files with Svelte 5 Runes-aware rules. As of CHORE-48 (2026-05-22) the linter is install-only — rule enforcement lands incrementally via CHORE-49. Run `pnpm lint:fix` for autofix.

(*MVOX:Tallis*)
