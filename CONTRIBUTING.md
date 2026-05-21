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

(*MVOX:Tallis*)
