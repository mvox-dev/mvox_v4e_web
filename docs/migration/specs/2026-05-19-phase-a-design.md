# Phase A — Additive Migration Design

**Status:** approved (PO + team-lead, 2026-05-19) — pending implementation
**Authors:** team-lead (Palestrina), PO
**Related:** [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md), `memory/team-lead.md` session 6, `teams/mvox-dev/memory/architecture-decisions.md`

## Context

Polyphony's live Entu database is pre-v4E shape (per the divergence finding 2026-05-19 00:35). PO decided to migrate in-place across four phases:

- **Phase A — Additive** (this spec): create new entity types, add new properties on existing types. No data migration, no renames, no rights changes.
- Phase B — property renames + data backfill (later)
- Phase C — structural restructurings (later)
- Phase D — rights / sharing flips + retirement of superseded types (later)

Phase A is the lowest-risk phase and validates the migration framework that subsequent phases will follow.

## Goals

1. Bring the polyphony Entu db's set of entity types and per-type properties to match the v4E schema (`~/projects/entu-research/docs/schema/v4E/schema.json`), additive operations only.
2. Run autonomously with PO observing the log; produce a structured post-execution report.
3. Be idempotent — safe and cheap to re-run.
4. Establish the operational pattern for Phases B, C, D scripts.

## Non-goals

- Renames, type changes, structural restructurings (Phases B / C / D).
- Data migration of any kind (no per-instance property backfill).
- Rights or sharing flips (Phase D).
- Touch-saving existing instances to materialize newly added formula properties — flagged in the report; executed as a separate post-Phase-A operation.
- Deletion or retirement of superseded entity types (Phase D).
- Interactive supervision: no per-step prompts. PO observes the log; report is the artifact.

## Design

### Locations

| Artifact | Path |
|---|---|
| Spec | `docs/migration/specs/2026-05-19-phase-a-design.md` (this file) |
| Implementation plan | `docs/migration/specs/2026-05-19-phase-a-plan.md` (written by writing-plans skill) |
| Migration script | `scripts/migrations/2026-05-19-phase-a.ts` |
| Tests | `scripts/migrations/2026-05-19-phase-a.spec.ts` (vitest, colocated per mvox convention) |
| Report output | `scripts/migrations/reports/2026-05-19-phase-a-<ISO-timestamp>.{json,md}` |

All paths are relative to the mvox repo root (`mvox-dev/mvox_v4e_web`).

### Execution environment

- **Runtime:** `tsx` (TypeScript via Node), matching the pattern of `~/projects/entu-research/scripts/setup-entity-types.ts`.
- **Invocation:** `pnpm exec tsx scripts/migrations/2026-05-19-phase-a.ts` (or with `--dry-run` for read-only diff preview).
- **Env vars required:**
  - `ENTU_API_BASE` — defaults to `https://api.entu.app`
  - `ENTU_DB` — defaults to `polyphony`
  - `ENTU_API_KEY` — long-lived key from `~/.config/mvox/credentials.env`; script exchanges for a 48h JWT on startup
  - `V4E_SCHEMA_PATH` — defaults to `~/projects/entu-research/docs/schema/v4E/schema.json`

### Algorithm

1. **Load v4E schema** from `V4E_SCHEMA_PATH`. Parse to typed v4E definitions.
2. **Fetch current polyphony db state:** list all entity types parented under the db entity (`69bcfd8e9c031ab8e6ce807a`); for each existing type, list its property definitions.
3. **Compute the additive diff:**
   - Missing entity types (in v4E, not in db) → `CREATE_TYPE`
   - Existing entity types missing properties (in v4E, not in db) → `ADD_PROPERTY`
   - Ignored: renames, type changes, deletions, rights/sharing changes (Phases B/C/D)
4. **Sort additions by dependency:**
   - All `CREATE_TYPE` operations first (entity types have no inter-type references at definition level)
   - `ADD_PROPERTY` operations second (some property additions may reference newly-created entity types via `reference_query`)
5. **Execute additions sequentially** via POST to Entu API; record outcome per operation.
6. **Formula-property handling:** if a property addition includes a `formula` field, the script creates the property definition but does NOT touch-save existing instances of the parent type. Each such addition is recorded in the report under `formulaTouchSaveDeferred` with the parent-type-name and the count of existing instances that need touch-saving.
7. **Emit report.** JSON to stdout; JSON + markdown to `scripts/migrations/reports/`.

### Idempotency

Before each create, query the db for existence:

- **Entity type existence:** filter db children of meta-type `entity` (`69bcfd8e9c031ab8e6ce8034`) by `name.string`.
- **Property existence:** filter children of the parent entity-type by meta-type `property` (`69bcfd8e9c031ab8e6ce8048`) and `name.string`.

If found, skip and record under `skipped` (with reason "already exists"). Re-runs incur only the read cost; no spurious duplicates.

### Error handling

- Each create operation wrapped in try/catch.
- Failures captured to a structured error log (HTTP status, error body, the entity-type or property being created, the request payload).
- Script does NOT abort on individual failures — continues to the next operation.
- Final exit code: `0` if all succeeded (zero `failed` entries), `1` otherwise.

### Report

Two files written per execution: `<timestamp>.json` and `<timestamp>.md`.

**JSON shape:**

```json
{
  "phase": "A",
  "executedAt": "2026-05-19T20:55:00Z",
  "schemaSource": {
    "path": "/home/michelek/projects/entu-research/docs/schema/v4E/schema.json",
    "fileHash": "sha256:..."
  },
  "db": "polyphony",
  "summary": {
    "createdTypes": 9,
    "addedProperties": 27,
    "skipped": 3,
    "failed": 0,
    "formulaTouchSaveDeferred": 1
  },
  "createdTypes": [{ "name": "voice", "id": "<new-id>", "createdAt": "..." }, ...],
  "addedProperties": [{ "parentType": "season", "name": "end_date", "id": "<new-id>", "createdAt": "..." }, ...],
  "skipped": [{ "kind": "type" | "property", "name": "...", "reason": "already exists" }],
  "failed": [{ "kind": "...", "name": "...", "httpStatus": 500, "body": "..." }],
  "formulaTouchSaveDeferred": [
    { "parentType": "edition", "property": "work", "existingInstances": 0, "note": "touch-save not needed (no existing instances)" }
  ]
}
```

**Markdown shape:** human-readable summary suitable to attach to the PR — counts, the lists of created/skipped/failed items, and the deferred touch-save items with sample touch-save commands.

### Dry-run mode

Invoking with `--dry-run`:

- Performs steps 1–4 (load schema, fetch db state, compute diff, sort).
- Does NOT execute step 5 (no writes).
- Emits the same report shape with `executedAt: null`, all items moved from `created*` to a new `wouldCreate*` field, and `summary.dryRun: true`.

Used by Bentham during review + by PO before greenlighting execution.

## Workflow

### TDD chain

| Phase | Owner | Deliverable |
|---|---|---|
| RED | Tallis | Vitest spec with fixtures: mock `schema.json` + mock db responses → assert correct diff + correct ordering + correct report shape. Smoke tests for idempotency and error handling. |
| GREEN | Josquin | Script implementation. Pattern-precedent: `~/projects/entu-research/scripts/setup-entity-types.ts`. |
| (no i18n) | Comenius skipped | No user-facing strings. |
| REVIEW | Bentham | Script review + spec cross-check + dry-run output review + pre-execution sign-off. |
| MERGE | Josquin | After Bentham GREEN + PO go. |
| EXECUTE | PO (observed) + Palestrina | `pnpm exec tsx scripts/migrations/2026-05-19-phase-a.ts`. Bentham + PO review the report. |

### PR requirements

- Standard mvox PR against `mvox-dev/mvox_v4e_web` `main`.
- Branch name: `feat/phase-a-migration` (or per Tallis's preference at RED).
- Commit trailers: standard `Co-authored-by:` (auto via prepare-commit-msg hook).
- The PR description includes the dry-run report output for the current db state.
- After PR merge AND post-execution run: a follow-up commit on `main` attaches the actual execution report (`scripts/migrations/reports/...`) for permanent record. This is a team-config-style commit, not a feature commit.

### Execution gate

PR is merged AFTER:

1. All vitest tests pass
2. Dry-run output reviewed by Bentham + PO
3. Bentham GREEN on the implementation
4. PO explicit go for execution

Execution happens within hours of merge (not days) — the schema state at execution time should match the schema state when reviewing the dry-run.

## Out of scope

- Phase B / C / D scripts — separate specs, follow the same pattern as this one.
- Per-instance touch-saving to materialize formula properties — separate post-Phase-A operation. Spec written if/when needed.
- BFF code changes consuming the new v4E entity types — separate stories. Each consumes via `Schema-Change: entu/research@<sha>` commit trailers per `memory/architecture-decisions.md`.
- Backup of polyphony db before Phase A — purely additive operations carry no data-loss risk. Backup strategy will be decided before Phase B (where backfills first appear).

## Open items (resolved with defaults)

| # | Item | Default | Revisit if |
|---|---|---|---|
| 1 | `schema.json` source at runtime | Local checkout path via `V4E_SCHEMA_PATH` env var | We automate via CI — switch to pinned GitHub URL with commit SHA |
| 2 | Touch-save existing instances for new formula properties | Deferred; flagged in report; manual operation post-Phase-A | A formula property is added that has many existing instances and needs to be live immediately |
| 3 | Schema-Change trailer convention reversal | No reversal needed — script lives in mvox, not entu/research | A future phase puts code in entu/research |

## References

- Handbook: [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md)
- v4E schema source-of-truth: `~/projects/entu-research/docs/schema/v4E/schema.json`
- Existing migration-script pattern: `~/projects/entu-research/scripts/setup-entity-types.ts`
- Architecture decisions: `teams/mvox-dev/memory/architecture-decisions.md`
- Way of Entu primer: [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md) §1.5
- Brilliant KB: `Decisions/mvox/polyphony-v4e-divergence` (`2a1e452e-5ca3-4e66-87a8-4a2d4c0acb82`)

(*MVOX:Palestrina*)
