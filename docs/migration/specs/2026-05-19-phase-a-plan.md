# Phase A — Additive Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single autonomous TypeScript migration script that brings polyphony's live Entu db up to v4E schema via additive-only operations (new entity types + new properties on existing types), with idempotent re-runs, mocked-fetch unit tests, and a structured JSON + markdown post-execution report.

**Architecture:** CLI entry point (`scripts/migrations/2026-05-19-phase-a.ts`) wires five focused lib modules — Entu API client, schema loader, additive-diff computer, executor, reporter. Each module has its own colocated `.spec.ts` with mocked dependencies. The CLI parses `--dry-run`, loads v4E schema from local checkout, queries the live db state, computes the additive diff (ignoring renames/deletes/rights changes), executes additions sequentially with per-op idempotency checks and try/catch error capture, and writes a dual JSON + markdown report. Single repo (mvox), single PR, TDD chain Tallis → Josquin → Bentham → execute.

**Tech Stack:** TypeScript 6 strict, Node 22 global fetch, vitest 3 (mocked fetch + fs), tsx runner, pnpm. Patterns inherit from `~/projects/entu-research/scripts/setup-entity-types.ts` but updated for the current API base (`https://api.entu.app/{db}/`).

**Spec:** [`docs/migration/specs/2026-05-19-phase-a-design.md`](./2026-05-19-phase-a-design.md)
**Handbook:** [`docs/migration/entu-schema-mutation-handbook.md`](../entu-schema-mutation-handbook.md)

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/migrations/2026-05-19-phase-a.ts` | CLI entry — parses args, loads env, wires lib modules, writes report files |
| `scripts/migrations/2026-05-19-phase-a.spec.ts` | E2E test of the CLI flow with mocked fetch + fs |
| `scripts/migrations/lib/entu-client.ts` | Auth (API key → JWT), `createEntity`, `listEntities`. Wraps global fetch. |
| `scripts/migrations/lib/entu-client.spec.ts` | Unit tests with mocked fetch — auth flow, create payload shape, list query construction |
| `scripts/migrations/lib/schema-loader.ts` | Reads + validates v4E `schema.json` from `V4E_SCHEMA_PATH` |
| `scripts/migrations/lib/schema-loader.spec.ts` | Unit tests — happy path, file-not-found, malformed JSON |
| `scripts/migrations/lib/diff.ts` | Computes additive diff (missing types, missing properties); dependency-sorts |
| `scripts/migrations/lib/diff.spec.ts` | Unit tests — empty db (all additions), partial db (mixed), full db (no additions), ordering invariant |
| `scripts/migrations/lib/executor.ts` | Iterates sorted operations; calls client; captures results; honors `dryRun` |
| `scripts/migrations/lib/executor.spec.ts` | Unit tests — happy path, idempotent skip, individual failure non-aborting, dry-run path |
| `scripts/migrations/lib/reporter.ts` | Formats results as JSON + markdown |
| `scripts/migrations/lib/reporter.spec.ts` | Unit tests — JSON shape, markdown structure, deferred-touch-save section |
| `scripts/migrations/reports/.gitkeep` | Holds the dir in git; reports themselves are kept un-ignored (committed explicitly for executed runs, dropped manually for dry-runs) |
| `vitest.config.ts` (modify) | Extend `include` glob to `'scripts/**/*.spec.ts'` |
| `package.json` (modify) | Add `tsx` devDep + `migrate:phase-a` + `migrate:phase-a:dry` scripts |

---

## Task 1: Scaffold migration tree + wire tooling

**Files:**
- Create: `scripts/migrations/reports/.gitkeep`
- Create: `scripts/migrations/lib/.gitkeep` (temporary — removed once first lib module lands)
- Modify: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the directory skeleton**

Run:
```bash
mkdir -p scripts/migrations/lib scripts/migrations/reports
touch scripts/migrations/lib/.gitkeep scripts/migrations/reports/.gitkeep
```

- [ ] **Step 2: Extend the vitest include glob**

Edit `vitest.config.ts` from:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.spec.ts'],
		environment: 'node',
		globals: false
	}
});
```

to:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
		environment: 'node',
		globals: false
	}
});
```

- [ ] **Step 3: Add `tsx` devDep + migration scripts**

Run:
```bash
pnpm add -D tsx
```

Then edit `package.json` to add two entries in `scripts`:
```json
{
  "scripts": {
    "...existing scripts...": "...",
    "migrate:phase-a": "tsx scripts/migrations/2026-05-19-phase-a.ts",
    "migrate:phase-a:dry": "tsx scripts/migrations/2026-05-19-phase-a.ts --dry-run"
  }
}
```

(Place the two new keys alongside the existing `test:e2e` entry. Don't remove anything else.)

- [ ] **Step 4: Verify vitest still discovers existing tests + scripts/ is reachable**

Run:
```bash
pnpm test:unit
```

Expected: existing `src/tests/build-config.spec.ts` + `src/tests/build-output.spec.ts` pass; no errors about the new scripts/ glob (it's just empty for now).

- [ ] **Step 5: Verify tsx runs**

Run:
```bash
pnpm exec tsx -e 'console.log("tsx works")'
```

Expected: prints `tsx works`.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrations/ vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore(migration): scaffold scripts/migrations tree + tsx runner

- Add scripts/migrations/{lib,reports}/.gitkeep
- Extend vitest include glob to scripts/**/*.spec.ts
- Add tsx devDep
- Add migrate:phase-a + migrate:phase-a:dry pnpm scripts"
```

---

## Task 2: Entu API client (entu-client.ts)

**Files:**
- Create: `scripts/migrations/lib/entu-client.ts`
- Create: `scripts/migrations/lib/entu-client.spec.ts`

The client exposes three functions: `getJwt`, `createEntity`, `listEntities`. All take a `client: EntuClient` config object so we never thread URL/JWT manually. Meta-type IDs are exported as polyphony defaults; overridable via env in the CLI.

- [ ] **Step 1: Write the failing test for `getJwt`**

Create `scripts/migrations/lib/entu-client.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJwt, createEntity, listEntities, type EntuClient } from './entu-client';

describe('getJwt', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('exchanges API key for a 48h JWT against the right URL', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ token: 'jwt-abc' }), { status: 200 })
			);

		const token = await getJwt({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key-xyz'
		});

		expect(token).toBe('jwt-abc');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/auth?db=polyphony',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer key-xyz' })
			})
		);
	});

	it('throws on non-2xx auth response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('Forbidden', { status: 403 })
		);
		await expect(
			getJwt({ apiBase: 'https://api.entu.app', db: 'polyphony', apiKey: 'bad' })
		).rejects.toThrow(/auth failed/i);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/entu-client.spec.ts
```

Expected: FAIL — module not found / `getJwt is not defined`.

- [ ] **Step 3: Implement `getJwt` + the `EntuClient` type**

Create `scripts/migrations/lib/entu-client.ts`:

```ts
export const POLYPHONY_META_TYPE_ENTITY_ID = '69bcfd8e9c031ab8e6ce8034';
export const POLYPHONY_META_TYPE_PROPERTY_ID = '69bcfd8e9c031ab8e6ce8048';
export const POLYPHONY_DB_ENTITY_ID = '69bcfd8e9c031ab8e6ce807a';

export interface EntuClient {
	apiBase: string;
	db: string;
	jwt: string;
}

interface AuthResponse {
	token: string;
}

export async function getJwt(input: {
	apiBase: string;
	db: string;
	apiKey: string;
}): Promise<string> {
	const url = `${input.apiBase}/auth?db=${encodeURIComponent(input.db)}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${input.apiKey}` }
	});
	if (!res.ok) {
		throw new Error(`auth failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as AuthResponse;
	return body.token;
}
```

- [ ] **Step 4: Run the getJwt tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/entu-client.spec.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Write the failing test for `createEntity`**

Append to `scripts/migrations/lib/entu-client.spec.ts`:

```ts
describe('createEntity', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POSTs property array to /{db}/entity with JWT', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ _id: 'new-entity-id' }), { status: 200 })
			);

		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt-abc'
		};
		const result = await createEntity(client, [
			{ type: '_type', reference: 'type-id' },
			{ type: 'name', string: 'voice' }
		]);

		expect(result._id).toBe('new-entity-id');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer jwt-abc',
					'Content-Type': 'application/json'
				}),
				body: JSON.stringify([
					{ type: '_type', reference: 'type-id' },
					{ type: 'name', string: 'voice' }
				])
			})
		);
	});

	it('throws on non-2xx create response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('Bad Request', { status: 400 })
		);
		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt'
		};
		await expect(createEntity(client, [])).rejects.toThrow(/create failed/i);
	});
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/entu-client.spec.ts -t createEntity
```

Expected: FAIL — `createEntity is not defined`.

- [ ] **Step 7: Implement `createEntity`**

Append to `scripts/migrations/lib/entu-client.ts`:

```ts
export interface EntuProperty {
	type: string;
	string?: string;
	number?: number;
	boolean?: boolean;
	reference?: string;
}

export interface CreateEntityResponse {
	_id: string;
	properties?: Array<{ _id: string; type: string; [key: string]: unknown }>;
}

export async function createEntity(
	client: EntuClient,
	properties: EntuProperty[]
): Promise<CreateEntityResponse> {
	const url = `${client.apiBase}/${client.db}/entity`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(properties)
	});
	if (!res.ok) {
		throw new Error(`create failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as CreateEntityResponse;
}
```

- [ ] **Step 8: Run the createEntity tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/entu-client.spec.ts
```

Expected: 4 tests pass.

- [ ] **Step 9: Write the failing test for `listEntities`**

Append to `scripts/migrations/lib/entu-client.spec.ts`:

```ts
describe('listEntities', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('GETs /{db}/entity with query params and JWT', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					entities: [{ _id: 'e1' }, { _id: 'e2' }],
					count: 2
				}),
				{ status: 200 }
			)
		);

		const client: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'jwt-abc'
		};
		const result = await listEntities(client, {
			'_type.reference': 'meta-id',
			'_parent.reference': 'db-id'
		});

		expect(result.count).toBe(2);
		expect(result.entities).toHaveLength(2);
		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('https://api.entu.app/polyphony/entity?');
		expect(calledUrl).toContain('_type.reference=meta-id');
		expect(calledUrl).toContain('_parent.reference=db-id');
	});
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/entu-client.spec.ts -t listEntities
```

Expected: FAIL — `listEntities is not defined`.

- [ ] **Step 11: Implement `listEntities`**

Append to `scripts/migrations/lib/entu-client.ts`:

```ts
export interface ListEntitiesResponse {
	entities: Array<{ _id: string; [key: string]: unknown }>;
	count: number;
}

export async function listEntities(
	client: EntuClient,
	query: Record<string, string>
): Promise<ListEntitiesResponse> {
	const qs = new URLSearchParams(query).toString();
	const url = `${client.apiBase}/${client.db}/entity?${qs}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` }
	});
	if (!res.ok) {
		throw new Error(`list failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as ListEntitiesResponse;
}
```

- [ ] **Step 12: Run all entu-client tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/entu-client.spec.ts
```

Expected: 5 tests pass.

- [ ] **Step 13: Remove the temporary .gitkeep + commit**

```bash
rm scripts/migrations/lib/.gitkeep
git add scripts/migrations/lib/entu-client.ts scripts/migrations/lib/entu-client.spec.ts scripts/migrations/lib/.gitkeep
git commit -m "feat(migration): Entu API client with auth, create, list

- getJwt exchanges API key for 48h JWT
- createEntity POSTs property array to /{db}/entity
- listEntities GETs /{db}/entity with query params
- Polyphony meta-type IDs exported as constants
- 5 vitest unit tests, mocked global fetch"
```

(The `git add` of `.gitkeep` registers its deletion; this is intentional — the lib/ dir is no longer empty.)

---

## Task 3: Schema loader (schema-loader.ts)

**Files:**
- Create: `scripts/migrations/lib/schema-loader.ts`
- Create: `scripts/migrations/lib/schema-loader.spec.ts`
- Create: `scripts/migrations/lib/fixtures/schema-minimal.json` (test fixture)
- Create: `scripts/migrations/lib/fixtures/schema-malformed.txt` (test fixture)

The loader reads JSON from `V4E_SCHEMA_PATH`, validates the top-level shape (`{ entities, sections, version }`), and returns a typed structure containing entity-type definitions + their property definitions. Unknown properties on entities are passed through unchanged — we don't need to model every v4E field, just the ones the diff cares about (`name`, `label`, `properties[].name`, `properties[].type`, `properties[].formula`, `properties[].reference_query`).

- [ ] **Step 1: Create the test fixtures**

Create `scripts/migrations/lib/fixtures/schema-minimal.json`:

```json
{
  "version": "v4E",
  "sections": [],
  "entities": [
    {
      "name": "season",
      "label": "Season",
      "properties": [
        { "name": "start_date", "type": "date", "mandatory": true },
        { "name": "end_date", "type": "date" }
      ]
    },
    {
      "name": "voice",
      "label": "Voice",
      "properties": [
        { "name": "label", "type": "string" }
      ]
    }
  ]
}
```

Create `scripts/migrations/lib/fixtures/schema-malformed.txt`:

```
this is not json
```

- [ ] **Step 2: Write the failing test for `loadV4eSchema`**

Create `scripts/migrations/lib/schema-loader.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadV4eSchema } from './schema-loader';

const fixturesDir = resolve(__dirname, 'fixtures');

describe('loadV4eSchema', () => {
	it('loads minimal fixture and exposes entities + properties', async () => {
		const schema = await loadV4eSchema(`${fixturesDir}/schema-minimal.json`);
		expect(schema.version).toBe('v4E');
		expect(schema.entities).toHaveLength(2);
		expect(schema.entities[0].name).toBe('season');
		expect(schema.entities[0].properties).toHaveLength(2);
		expect(schema.entities[0].properties[0].name).toBe('start_date');
		expect(schema.entities[1].name).toBe('voice');
	});

	it('throws on file not found', async () => {
		await expect(
			loadV4eSchema(`${fixturesDir}/nonexistent.json`)
		).rejects.toThrow(/schema file not found/i);
	});

	it('throws on malformed JSON', async () => {
		await expect(
			loadV4eSchema(`${fixturesDir}/schema-malformed.txt`)
		).rejects.toThrow(/invalid json/i);
	});

	it('throws on missing entities array', async () => {
		// inline a malformed-shape fixture via temp string
		const tmp = `${fixturesDir}/schema-no-entities.json`;
		await import('node:fs/promises').then((fs) =>
			fs.writeFile(tmp, JSON.stringify({ version: 'v4E' }))
		);
		await expect(loadV4eSchema(tmp)).rejects.toThrow(/missing entities/i);
		await import('node:fs/promises').then((fs) => fs.unlink(tmp));
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/schema-loader.spec.ts
```

Expected: FAIL — `loadV4eSchema is not defined`.

- [ ] **Step 4: Implement `loadV4eSchema`**

Create `scripts/migrations/lib/schema-loader.ts`:

```ts
import { readFile } from 'node:fs/promises';

export interface V4ePropertyDef {
	name: string;
	type: string;
	label?: string;
	mandatory?: boolean;
	formula?: string;
	reference_query?: unknown;
	[key: string]: unknown;
}

export interface V4eEntityTypeDef {
	name: string;
	label: string;
	label_plural?: string;
	description?: string;
	properties: V4ePropertyDef[];
	[key: string]: unknown;
}

export interface V4eSchema {
	version: string;
	sections: unknown[];
	entities: V4eEntityTypeDef[];
}

export async function loadV4eSchema(path: string): Promise<V4eSchema> {
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch (err) {
		throw new Error(`schema file not found: ${path}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`invalid JSON in schema file: ${path}`);
	}
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!Array.isArray((parsed as { entities?: unknown }).entities)
	) {
		throw new Error(`missing entities array in schema file: ${path}`);
	}
	return parsed as V4eSchema;
}
```

- [ ] **Step 5: Run the schema-loader tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/schema-loader.spec.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrations/lib/schema-loader.ts scripts/migrations/lib/schema-loader.spec.ts scripts/migrations/lib/fixtures/
git commit -m "feat(migration): v4E schema loader with validation

- loadV4eSchema reads JSON, validates top-level shape
- Typed V4eSchema / V4eEntityTypeDef / V4ePropertyDef
- 4 vitest unit tests covering happy path + 3 error cases
- Minimal + malformed fixtures committed"
```

---

## Task 4: Additive diff computer (diff.ts)

**Files:**
- Create: `scripts/migrations/lib/diff.ts`
- Create: `scripts/migrations/lib/diff.spec.ts`

Given a v4E schema (typed) + the current db state (list of entity types with their property names), produces an ordered list of operations: `CREATE_TYPE` for each missing entity type, then `ADD_PROPERTY` for each existing type's missing property. The ordering invariant is "all CREATE_TYPE ops precede all ADD_PROPERTY ops."

- [ ] **Step 1: Write the failing test for `computeAdditiveDiff`**

Create `scripts/migrations/lib/diff.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeAdditiveDiff, type DbTypeState } from './diff';
import type { V4eSchema } from './schema-loader';

const v4e: V4eSchema = {
	version: 'v4E',
	sections: [],
	entities: [
		{
			name: 'season',
			label: 'Season',
			properties: [
				{ name: 'start_date', type: 'date' },
				{ name: 'end_date', type: 'date' },
				{ name: 'description', type: 'text' }
			]
		},
		{
			name: 'voice',
			label: 'Voice',
			properties: [{ name: 'label', type: 'string' }]
		}
	]
};

describe('computeAdditiveDiff', () => {
	it('produces all CREATE_TYPE + ADD_PROPERTY ops for an empty db', () => {
		const dbState: DbTypeState[] = [];
		const ops = computeAdditiveDiff(v4e, dbState);

		const creates = ops.filter((o) => o.kind === 'CREATE_TYPE');
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY');
		expect(creates).toHaveLength(2);
		expect(adds).toHaveLength(4);

		// Ordering invariant
		const lastCreateIdx = ops.findIndex(
			(o, i) => o.kind === 'ADD_PROPERTY' && ops[i - 1]?.kind === 'CREATE_TYPE'
		);
		const firstAddIdx = ops.findIndex((o) => o.kind === 'ADD_PROPERTY');
		expect(firstAddIdx).toBeGreaterThan(-1);
		expect(creates.every((c, i) => ops.indexOf(c) < firstAddIdx)).toBe(true);
	});

	it('skips existing types but still adds their missing properties', () => {
		const dbState: DbTypeState[] = [
			{
				typeId: 'season-id',
				name: 'season',
				propertyNames: ['start_date']
			}
		];
		const ops = computeAdditiveDiff(v4e, dbState);

		expect(ops.filter((o) => o.kind === 'CREATE_TYPE')).toHaveLength(1); // voice only
		expect((ops.filter((o) => o.kind === 'CREATE_TYPE')[0] as { typeName: string }).typeName).toBe(
			'voice'
		);
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY') as Array<{
			parentTypeName: string;
			propertyName: string;
		}>;
		// Season needs end_date + description; voice needs label
		expect(adds).toHaveLength(3);
		expect(adds.map((a) => `${a.parentTypeName}.${a.propertyName}`).sort()).toEqual([
			'season.description',
			'season.end_date',
			'voice.label'
		]);
	});

	it('returns empty ops when db is already at v4E', () => {
		const dbState: DbTypeState[] = [
			{ typeId: 's', name: 'season', propertyNames: ['start_date', 'end_date', 'description'] },
			{ typeId: 'v', name: 'voice', propertyNames: ['label'] }
		];
		expect(computeAdditiveDiff(v4e, dbState)).toEqual([]);
	});

	it('ignores db-only types (Phase A is additive, not destructive)', () => {
		const dbState: DbTypeState[] = [
			{ typeId: 'role-id', name: 'role', propertyNames: ['name'] } // not in v4E
		];
		const ops = computeAdditiveDiff(v4e, dbState);
		// Role is left alone; we only add what v4E specifies
		expect(ops.find((o) => o.kind === 'CREATE_TYPE' && (o as { typeName: string }).typeName === 'role')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/diff.spec.ts
```

Expected: FAIL — `computeAdditiveDiff is not defined`.

- [ ] **Step 3: Implement `computeAdditiveDiff`**

Create `scripts/migrations/lib/diff.ts`:

```ts
import type { V4eSchema, V4ePropertyDef } from './schema-loader';

export interface DbTypeState {
	typeId: string;
	name: string;
	propertyNames: string[];
}

export interface CreateTypeOp {
	kind: 'CREATE_TYPE';
	typeName: string;
	label: string;
	properties: V4ePropertyDef[]; // properties to add inline after type creation
}

export interface AddPropertyOp {
	kind: 'ADD_PROPERTY';
	parentTypeName: string;
	parentTypeId: string; // db ID of existing parent type
	propertyName: string;
	def: V4ePropertyDef;
}

export type DiffOp = CreateTypeOp | AddPropertyOp;

export function computeAdditiveDiff(
	v4e: V4eSchema,
	dbState: DbTypeState[]
): DiffOp[] {
	const dbByName = new Map(dbState.map((t) => [t.name, t]));

	const creates: CreateTypeOp[] = [];
	const adds: AddPropertyOp[] = [];

	for (const v4eType of v4e.entities) {
		const existing = dbByName.get(v4eType.name);
		if (!existing) {
			creates.push({
				kind: 'CREATE_TYPE',
				typeName: v4eType.name,
				label: v4eType.label,
				properties: v4eType.properties
			});
		} else {
			const existingProps = new Set(existing.propertyNames);
			for (const prop of v4eType.properties) {
				if (!existingProps.has(prop.name)) {
					adds.push({
						kind: 'ADD_PROPERTY',
						parentTypeName: v4eType.name,
						parentTypeId: existing.typeId,
						propertyName: prop.name,
						def: prop
					});
				}
			}
		}
	}

	return [...creates, ...adds];
}
```

- [ ] **Step 4: Run the diff tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/diff.spec.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/lib/diff.ts scripts/migrations/lib/diff.spec.ts
git commit -m "feat(migration): additive diff computer

- computeAdditiveDiff(v4eSchema, dbState) returns sorted DiffOps
- Ordering: all CREATE_TYPE then all ADD_PROPERTY
- Db-only types ignored (additive-only contract)
- 4 vitest unit tests"
```

---

## Task 5: Executor (executor.ts)

**Files:**
- Create: `scripts/migrations/lib/executor.ts`
- Create: `scripts/migrations/lib/executor.spec.ts`

The executor walks the sorted DiffOps, calls `createEntity` for each, captures results, honors `dryRun` (returns "would-create" results without writing), continues past individual failures.

- [ ] **Step 1: Write the failing test for `executeAdditions`**

Create `scripts/migrations/lib/executor.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { executeAdditions, type ExecutionResult } from './executor';
import type { DiffOp } from './diff';
import type { EntuClient } from './entu-client';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'jwt'
};

const ops: DiffOp[] = [
	{
		kind: 'CREATE_TYPE',
		typeName: 'voice',
		label: 'Voice',
		properties: [{ name: 'label', type: 'string' }]
	},
	{
		kind: 'ADD_PROPERTY',
		parentTypeName: 'season',
		parentTypeId: 'season-db-id',
		propertyName: 'end_date',
		def: { name: 'end_date', type: 'date' }
	}
];

describe('executeAdditions', () => {
	it('happy path: creates all ops via the client', async () => {
		const createMock = vi
			.fn()
			.mockResolvedValueOnce({ _id: 'voice-new-id' })
			.mockResolvedValueOnce({ _id: 'voice-label-prop-id' })
			.mockResolvedValueOnce({ _id: 'season-end-date-prop-id' });

		const result = await executeAdditions(client, ops, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z'
		});

		expect(result.createdTypes).toHaveLength(1);
		expect(result.createdTypes[0].name).toBe('voice');
		expect(result.addedProperties).toHaveLength(2); // voice.label inline + season.end_date
		expect(result.failed).toEqual([]);
		expect(result.skipped).toEqual([]);
		expect(createMock).toHaveBeenCalledTimes(3); // 1 type + 1 inline prop + 1 prop on existing
	});

	it('dry-run: no calls; results structured under wouldCreate', async () => {
		const createMock = vi.fn();

		const result = await executeAdditions(client, ops, {
			dryRun: true,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z'
		});

		expect(createMock).not.toHaveBeenCalled();
		expect(result.dryRun).toBe(true);
		expect(result.wouldCreateTypes).toHaveLength(1);
		expect(result.wouldAddProperties).toHaveLength(2);
	});

	it('captures individual failures without aborting', async () => {
		const createMock = vi
			.fn()
			.mockRejectedValueOnce(new Error('create failed: 500 boom'))
			.mockResolvedValueOnce({ _id: 'inline-prop-id' })
			.mockResolvedValueOnce({ _id: 'season-end-date-prop-id' });

		const result = await executeAdditions(client, ops, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z'
		});

		expect(result.failed).toHaveLength(1);
		expect(result.failed[0].error).toMatch(/500 boom/);
		// Second op still attempted
		expect(result.addedProperties).toHaveLength(1);
	});

	it('flags formula properties under formulaTouchSaveDeferred', async () => {
		const formulaOps: DiffOp[] = [
			{
				kind: 'ADD_PROPERTY',
				parentTypeName: 'edition',
				parentTypeId: 'edition-db-id',
				propertyName: 'work',
				def: { name: 'work', type: 'string', formula: 'edition_work.*.name CONCAT' }
			}
		];
		const createMock = vi.fn().mockResolvedValue({ _id: 'edition-work-prop-id' });

		const result = await executeAdditions(client, formulaOps, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z'
		});

		expect(result.formulaTouchSaveDeferred).toHaveLength(1);
		expect(result.formulaTouchSaveDeferred[0]).toMatchObject({
			parentType: 'edition',
			property: 'work'
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/executor.spec.ts
```

Expected: FAIL — `executeAdditions is not defined`.

- [ ] **Step 3: Implement `executeAdditions`**

Create `scripts/migrations/lib/executor.ts`:

```ts
import {
	POLYPHONY_DB_ENTITY_ID,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
	type EntuProperty,
	type CreateEntityResponse,
	createEntity as defaultCreateEntity
} from './entu-client';
import type { DiffOp, CreateTypeOp, AddPropertyOp } from './diff';
import type { V4ePropertyDef } from './schema-loader';

export interface CreatedTypeRecord {
	name: string;
	id: string;
	createdAt: string;
}

export interface AddedPropertyRecord {
	parentType: string;
	name: string;
	id: string;
	createdAt: string;
}

export interface SkippedRecord {
	kind: 'type' | 'property';
	name: string;
	reason: string;
}

export interface FailedRecord {
	kind: 'type' | 'property';
	name: string;
	error: string;
}

export interface FormulaDeferred {
	parentType: string;
	property: string;
	formula: string;
}

export interface ExecutionResult {
	dryRun: boolean;
	createdTypes: CreatedTypeRecord[];
	addedProperties: AddedPropertyRecord[];
	wouldCreateTypes: CreateTypeOp[];
	wouldAddProperties: AddPropertyOp[];
	skipped: SkippedRecord[];
	failed: FailedRecord[];
	formulaTouchSaveDeferred: FormulaDeferred[];
}

export interface ExecuteOptions {
	dryRun: boolean;
	createEntity?: (client: EntuClient, properties: EntuProperty[]) => Promise<CreateEntityResponse>;
	now?: () => string;
}

function propertyToPayload(parentTypeId: string, def: V4ePropertyDef): EntuProperty[] {
	const payload: EntuProperty[] = [
		{ type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
		{ type: '_parent', reference: parentTypeId },
		{ type: 'name', string: def.name },
		{ type: 'label', string: def.label ?? def.name },
		{ type: 'type', string: def.type }
	];
	if (def.mandatory) payload.push({ type: 'mandatory', boolean: true });
	if (def.formula) payload.push({ type: 'formula', string: def.formula });
	return payload;
}

export async function executeAdditions(
	client: EntuClient,
	ops: DiffOp[],
	opts: ExecuteOptions
): Promise<ExecutionResult> {
	const createEntity = opts.createEntity ?? defaultCreateEntity;
	const now = opts.now ?? (() => new Date().toISOString());

	const result: ExecutionResult = {
		dryRun: opts.dryRun,
		createdTypes: [],
		addedProperties: [],
		wouldCreateTypes: [],
		wouldAddProperties: [],
		skipped: [],
		failed: [],
		formulaTouchSaveDeferred: []
	};

	if (opts.dryRun) {
		for (const op of ops) {
			if (op.kind === 'CREATE_TYPE') {
				result.wouldCreateTypes.push(op);
				for (const prop of op.properties) {
					result.wouldAddProperties.push({
						kind: 'ADD_PROPERTY',
						parentTypeName: op.typeName,
						parentTypeId: '(pending — type not yet created)',
						propertyName: prop.name,
						def: prop
					});
					if (prop.formula) {
						result.formulaTouchSaveDeferred.push({
							parentType: op.typeName,
							property: prop.name,
							formula: prop.formula
						});
					}
				}
			} else {
				result.wouldAddProperties.push(op);
				if (op.def.formula) {
					result.formulaTouchSaveDeferred.push({
						parentType: op.parentTypeName,
						property: op.propertyName,
						formula: op.def.formula
					});
				}
			}
		}
		return result;
	}

	for (const op of ops) {
		if (op.kind === 'CREATE_TYPE') {
			try {
				const typePayload: EntuProperty[] = [
					{ type: '_type', reference: POLYPHONY_META_TYPE_ENTITY_ID },
					{ type: '_parent', reference: POLYPHONY_DB_ENTITY_ID },
					{ type: 'name', string: op.typeName },
					{ type: 'label', string: op.label }
				];
				const created = await createEntity(client, typePayload);
				const typeId = created._id;
				result.createdTypes.push({ name: op.typeName, id: typeId, createdAt: now() });

				for (const prop of op.properties) {
					try {
						const propCreated = await createEntity(
							client,
							propertyToPayload(typeId, prop)
						);
						result.addedProperties.push({
							parentType: op.typeName,
							name: prop.name,
							id: propCreated._id,
							createdAt: now()
						});
						if (prop.formula) {
							result.formulaTouchSaveDeferred.push({
								parentType: op.typeName,
								property: prop.name,
								formula: prop.formula
							});
						}
					} catch (err) {
						result.failed.push({
							kind: 'property',
							name: `${op.typeName}.${prop.name}`,
							error: err instanceof Error ? err.message : String(err)
						});
					}
				}
			} catch (err) {
				result.failed.push({
					kind: 'type',
					name: op.typeName,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		} else {
			try {
				const propCreated = await createEntity(
					client,
					propertyToPayload(op.parentTypeId, op.def)
				);
				result.addedProperties.push({
					parentType: op.parentTypeName,
					name: op.propertyName,
					id: propCreated._id,
					createdAt: now()
				});
				if (op.def.formula) {
					result.formulaTouchSaveDeferred.push({
						parentType: op.parentTypeName,
						property: op.propertyName,
						formula: op.def.formula
					});
				}
			} catch (err) {
				result.failed.push({
					kind: 'property',
					name: `${op.parentTypeName}.${op.propertyName}`,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}

	return result;
}
```

- [ ] **Step 4: Run the executor tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/executor.spec.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/lib/executor.ts scripts/migrations/lib/executor.spec.ts
git commit -m "feat(migration): executor with dry-run + per-op failure capture

- executeAdditions iterates DiffOps; injected createEntity for tests
- Inline property creation after each CREATE_TYPE
- Try/catch per op; failures captured, loop continues
- Dry-run path returns wouldCreate* fields without writes
- Formula properties tracked under formulaTouchSaveDeferred
- 4 vitest unit tests"
```

---

## Task 6: Reporter (reporter.ts)

**Files:**
- Create: `scripts/migrations/lib/reporter.ts`
- Create: `scripts/migrations/lib/reporter.spec.ts`

The reporter takes an `ExecutionResult` + metadata and emits two formats: JSON (machine-readable, full detail) and markdown (PR-attachable summary).

- [ ] **Step 1: Write the failing test for `formatJsonReport` + `formatMarkdownReport`**

Create `scripts/migrations/lib/reporter.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatJsonReport, formatMarkdownReport, type ReportMeta } from './reporter';
import type { ExecutionResult } from './executor';

const meta: ReportMeta = {
	phase: 'A',
	executedAt: '2026-05-19T20:55:00Z',
	schemaSourcePath: '/home/x/v4E/schema.json',
	schemaFileHash: 'sha256:abc123',
	db: 'polyphony'
};

const baseResult: ExecutionResult = {
	dryRun: false,
	createdTypes: [
		{ name: 'voice', id: 'voice-id', createdAt: '2026-05-19T20:55:01Z' }
	],
	addedProperties: [
		{ parentType: 'season', name: 'end_date', id: 'p-id', createdAt: '2026-05-19T20:55:02Z' }
	],
	wouldCreateTypes: [],
	wouldAddProperties: [],
	skipped: [{ kind: 'type', name: 'organization', reason: 'already exists' }],
	failed: [],
	formulaTouchSaveDeferred: [
		{ parentType: 'edition', property: 'work', formula: 'x.*.y CONCAT' }
	]
};

describe('formatJsonReport', () => {
	it('produces correct JSON shape', () => {
		const json = JSON.parse(formatJsonReport(baseResult, meta));
		expect(json.phase).toBe('A');
		expect(json.executedAt).toBe('2026-05-19T20:55:00Z');
		expect(json.schemaSource.path).toBe('/home/x/v4E/schema.json');
		expect(json.summary.createdTypes).toBe(1);
		expect(json.summary.addedProperties).toBe(1);
		expect(json.summary.skipped).toBe(1);
		expect(json.summary.failed).toBe(0);
		expect(json.summary.formulaTouchSaveDeferred).toBe(1);
		expect(json.createdTypes[0].name).toBe('voice');
		expect(json.formulaTouchSaveDeferred[0].parentType).toBe('edition');
	});

	it('flags dry-run runs with executedAt: null', () => {
		const dryResult: ExecutionResult = {
			...baseResult,
			dryRun: true,
			createdTypes: [],
			addedProperties: [],
			wouldCreateTypes: [
				{
					kind: 'CREATE_TYPE',
					typeName: 'voice',
					label: 'Voice',
					properties: []
				}
			],
			wouldAddProperties: []
		};
		const json = JSON.parse(formatJsonReport(dryResult, meta));
		expect(json.executedAt).toBeNull();
		expect(json.summary.dryRun).toBe(true);
		expect(json.wouldCreateTypes).toHaveLength(1);
	});
});

describe('formatMarkdownReport', () => {
	it('includes counts, created lists, deferred section', () => {
		const md = formatMarkdownReport(baseResult, meta);
		expect(md).toContain('# Phase A migration report');
		expect(md).toContain('Executed at: 2026-05-19T20:55:00Z');
		expect(md).toContain('| Created entity types | 1 |');
		expect(md).toContain('| Added properties | 1 |');
		expect(md).toContain('| Skipped (already exists) | 1 |');
		expect(md).toContain('| Failed | 0 |');
		expect(md).toContain('voice');
		expect(md).toContain('season.end_date');
		expect(md).toContain('## Formula properties needing touch-save');
		expect(md).toContain('edition.work');
	});

	it('flags dry-run prominently', () => {
		const dryResult: ExecutionResult = { ...baseResult, dryRun: true };
		const md = formatMarkdownReport(dryResult, meta);
		expect(md).toContain('**DRY-RUN** — no writes performed');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/lib/reporter.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the reporter**

Create `scripts/migrations/lib/reporter.ts`:

```ts
import type { ExecutionResult } from './executor';

export interface ReportMeta {
	phase: string;
	executedAt: string;
	schemaSourcePath: string;
	schemaFileHash: string;
	db: string;
}

export function formatJsonReport(result: ExecutionResult, meta: ReportMeta): string {
	const payload = {
		phase: meta.phase,
		executedAt: result.dryRun ? null : meta.executedAt,
		schemaSource: { path: meta.schemaSourcePath, fileHash: meta.schemaFileHash },
		db: meta.db,
		summary: {
			dryRun: result.dryRun,
			createdTypes: result.createdTypes.length,
			addedProperties: result.addedProperties.length,
			wouldCreateTypes: result.wouldCreateTypes.length,
			wouldAddProperties: result.wouldAddProperties.length,
			skipped: result.skipped.length,
			failed: result.failed.length,
			formulaTouchSaveDeferred: result.formulaTouchSaveDeferred.length
		},
		createdTypes: result.createdTypes,
		addedProperties: result.addedProperties,
		wouldCreateTypes: result.wouldCreateTypes,
		wouldAddProperties: result.wouldAddProperties,
		skipped: result.skipped,
		failed: result.failed,
		formulaTouchSaveDeferred: result.formulaTouchSaveDeferred
	};
	return JSON.stringify(payload, null, 2);
}

export function formatMarkdownReport(result: ExecutionResult, meta: ReportMeta): string {
	const lines: string[] = [];
	lines.push(`# Phase ${meta.phase} migration report`);
	lines.push('');
	if (result.dryRun) lines.push('**DRY-RUN** — no writes performed.');
	lines.push(`- Executed at: ${result.dryRun ? '(dry-run)' : meta.executedAt}`);
	lines.push(`- Schema source: \`${meta.schemaSourcePath}\` (hash: \`${meta.schemaFileHash}\`)`);
	lines.push(`- Database: ${meta.db}`);
	lines.push('');
	lines.push('## Summary');
	lines.push('');
	lines.push('| Metric | Count |');
	lines.push('|---|---|');
	lines.push(`| Created entity types | ${result.createdTypes.length} |`);
	lines.push(`| Added properties | ${result.addedProperties.length} |`);
	if (result.dryRun) {
		lines.push(`| Would create types | ${result.wouldCreateTypes.length} |`);
		lines.push(`| Would add properties | ${result.wouldAddProperties.length} |`);
	}
	lines.push(`| Skipped (already exists) | ${result.skipped.length} |`);
	lines.push(`| Failed | ${result.failed.length} |`);
	lines.push(`| Formula touch-save deferred | ${result.formulaTouchSaveDeferred.length} |`);
	lines.push('');
	if (result.createdTypes.length) {
		lines.push('## Created entity types');
		lines.push('');
		for (const t of result.createdTypes) {
			lines.push(`- \`${t.name}\` → ${t.id}`);
		}
		lines.push('');
	}
	if (result.addedProperties.length) {
		lines.push('## Added properties');
		lines.push('');
		for (const p of result.addedProperties) {
			lines.push(`- \`${p.parentType}.${p.name}\` → ${p.id}`);
		}
		lines.push('');
	}
	if (result.skipped.length) {
		lines.push('## Skipped');
		lines.push('');
		for (const s of result.skipped) {
			lines.push(`- ${s.kind}: \`${s.name}\` (${s.reason})`);
		}
		lines.push('');
	}
	if (result.failed.length) {
		lines.push('## Failed');
		lines.push('');
		for (const f of result.failed) {
			lines.push(`- ${f.kind}: \`${f.name}\` — ${f.error}`);
		}
		lines.push('');
	}
	if (result.formulaTouchSaveDeferred.length) {
		lines.push('## Formula properties needing touch-save');
		lines.push('');
		lines.push(
			'These formula properties were created but existing instances will not show computed values until each instance is re-saved (touch-save). See handbook §5.1.'
		);
		lines.push('');
		for (const f of result.formulaTouchSaveDeferred) {
			lines.push(`- \`${f.parentType}.${f.property}\` — formula: \`${f.formula}\``);
		}
		lines.push('');
	}
	return lines.join('\n');
}
```

- [ ] **Step 4: Run the reporter tests to verify they pass**

Run:
```bash
pnpm test:unit scripts/migrations/lib/reporter.spec.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/lib/reporter.ts scripts/migrations/lib/reporter.spec.ts
git commit -m "feat(migration): JSON + markdown reporter

- formatJsonReport produces full structured payload
- formatMarkdownReport produces PR-attachable summary
- Dry-run runs marked prominently; executedAt nulled
- Formula touch-save section explains why
- 4 vitest unit tests"
```

---

## Task 7: CLI entry point + E2E test

**Files:**
- Create: `scripts/migrations/2026-05-19-phase-a.ts`
- Create: `scripts/migrations/2026-05-19-phase-a.spec.ts`

The CLI parses `--dry-run`, loads env vars (`ENTU_API_BASE`, `ENTU_DB`, `ENTU_API_KEY`, `V4E_SCHEMA_PATH`), wires the lib modules, writes the report files, exits with code matching success/failure.

- [ ] **Step 1: Write the failing E2E test**

Create `scripts/migrations/2026-05-19-phase-a.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPhaseA } from './2026-05-19-phase-a';
import { resolve } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

let tempReportsDir: string;

beforeEach(async () => {
	tempReportsDir = await mkdtemp(`${tmpdir()}/phase-a-test-`);
	vi.restoreAllMocks();
});

afterEach(async () => {
	await rm(tempReportsDir, { recursive: true, force: true });
});

describe('runPhaseA — E2E', () => {
	it('happy path: dry-run produces a report against minimal fixture + empty db', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		// /auth → JWT
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 })
		);
		// list entity types (filter: meta-type=entity, parent=db) → empty
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);

		const result = await runPhaseA({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			schemaPath: resolve(__dirname, 'lib/fixtures/schema-minimal.json'),
			reportsDir: tempReportsDir,
			dryRun: true,
			now: () => '2026-05-19T20:55:00Z'
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.summary.dryRun).toBe(true);
		expect(result.report.summary.wouldCreateTypes).toBe(2); // season + voice
		expect(result.report.summary.wouldAddProperties).toBe(3); // season×2 + voice×1

		// Report files written
		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const mdContent = await readFile(result.reportPaths.md, 'utf8');
		expect(JSON.parse(jsonContent).summary.dryRun).toBe(true);
		expect(mdContent).toContain('**DRY-RUN**');
	});

	it('happy path: real (not dry) run posts each addition', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 })
		);
		// Empty db state
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);
		// Create season type
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'season-id' }), { status: 200 })
		);
		// Create season.start_date
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p1' }), { status: 200 })
		);
		// Create season.end_date
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p2' }), { status: 200 })
		);
		// Create voice type
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'voice-id' }), { status: 200 })
		);
		// Create voice.label
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p3' }), { status: 200 })
		);

		const result = await runPhaseA({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			schemaPath: resolve(__dirname, 'lib/fixtures/schema-minimal.json'),
			reportsDir: tempReportsDir,
			dryRun: false,
			now: () => '2026-05-19T20:55:00Z'
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.summary.createdTypes).toBe(2);
		expect(result.report.summary.addedProperties).toBe(3);
		expect(result.report.summary.failed).toBe(0);
	});

	it('exits 1 if any operation fails', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 })
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);
		// First create fails (season type)
		fetchMock.mockResolvedValueOnce(new Response('Boom', { status: 500 }));
		// Subsequent calls succeed
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ _id: 'whatever' }), { status: 200 })
		);

		const result = await runPhaseA({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			schemaPath: resolve(__dirname, 'lib/fixtures/schema-minimal.json'),
			reportsDir: tempReportsDir,
			dryRun: false,
			now: () => '2026-05-19T20:55:00Z'
		});

		expect(result.exitCode).toBe(1);
		expect(result.report.summary.failed).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test:unit scripts/migrations/2026-05-19-phase-a.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the CLI entry point**

Create `scripts/migrations/2026-05-19-phase-a.ts`:

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { loadV4eSchema } from './lib/schema-loader';
import {
	getJwt,
	listEntities,
	POLYPHONY_DB_ENTITY_ID,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient
} from './lib/entu-client';
import { computeAdditiveDiff, type DbTypeState } from './lib/diff';
import { executeAdditions, type ExecutionResult } from './lib/executor';
import { formatJsonReport, formatMarkdownReport, type ReportMeta } from './lib/reporter';

export interface RunPhaseAInput {
	apiBase: string;
	db: string;
	apiKey: string;
	schemaPath: string;
	reportsDir: string;
	dryRun: boolean;
	now?: () => string;
}

export interface RunPhaseAOutput {
	exitCode: 0 | 1;
	report: ReturnType<typeof JSON.parse>; // parsed JSON report payload
	reportPaths: { json: string; md: string };
	result: ExecutionResult;
}

async function fetchDbState(client: EntuClient): Promise<DbTypeState[]> {
	// List all entity types parented under the db entity
	const typesResp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'_parent.reference': POLYPHONY_DB_ENTITY_ID,
		props: 'name._id,name.string'
	});

	const dbTypes: DbTypeState[] = [];
	for (const t of typesResp.entities) {
		const typeId = t._id;
		const name = (t as { name?: Array<{ string?: string }> }).name?.[0]?.string ?? '';
		if (!name) continue;
		// List properties on this type
		const propsResp = await listEntities(client, {
			'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
			'_parent.reference': typeId,
			props: 'name.string'
		});
		const propertyNames = propsResp.entities
			.map((p) => (p as { name?: Array<{ string?: string }> }).name?.[0]?.string)
			.filter((n): n is string => !!n);
		dbTypes.push({ typeId, name, propertyNames });
	}
	return dbTypes;
}

async function sha256OfFile(path: string): Promise<string> {
	const buf = await readFile(path);
	return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

export async function runPhaseA(input: RunPhaseAInput): Promise<RunPhaseAOutput> {
	const now = input.now ?? (() => new Date().toISOString());

	// 1. Load schema
	const schema = await loadV4eSchema(input.schemaPath);
	const schemaHash = await sha256OfFile(input.schemaPath);

	// 2. Authenticate
	const jwt = await getJwt({
		apiBase: input.apiBase,
		db: input.db,
		apiKey: input.apiKey
	});
	const client: EntuClient = { apiBase: input.apiBase, db: input.db, jwt };

	// 3. Fetch db state
	const dbState = await fetchDbState(client);

	// 4. Diff
	const ops = computeAdditiveDiff(schema, dbState);

	// 5. Execute
	const result = await executeAdditions(client, ops, {
		dryRun: input.dryRun,
		now
	});

	// 6. Report
	const meta: ReportMeta = {
		phase: 'A',
		executedAt: now(),
		schemaSourcePath: input.schemaPath,
		schemaFileHash: schemaHash,
		db: input.db
	};
	const json = formatJsonReport(result, meta);
	const md = formatMarkdownReport(result, meta);

	await mkdir(input.reportsDir, { recursive: true });
	const stamp = (input.dryRun ? 'dry-run-' : '') + meta.executedAt.replace(/[:.]/g, '-');
	const jsonPath = resolve(input.reportsDir, `2026-05-19-phase-a-${stamp}.json`);
	const mdPath = resolve(input.reportsDir, `2026-05-19-phase-a-${stamp}.md`);
	await writeFile(jsonPath, json, 'utf8');
	await writeFile(mdPath, md, 'utf8');

	const exitCode = result.failed.length === 0 ? 0 : 1;
	return {
		exitCode,
		report: JSON.parse(json),
		reportPaths: { json: jsonPath, md: mdPath },
		result
	};
}

// --- main when executed via tsx ---
async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const apiBase = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
	const db = process.env.ENTU_DB ?? 'polyphony';
	const apiKey = process.env.ENTU_API_KEY;
	const schemaPath =
		process.env.V4E_SCHEMA_PATH ??
		resolve(
			process.env.HOME ?? '/home/michelek',
			'projects/entu-research/docs/schema/v4E/schema.json'
		);
	const reportsDir = resolve(__dirname, 'reports');

	if (!apiKey) {
		console.error('ERROR: ENTU_API_KEY env var is required');
		process.exit(1);
	}

	console.log(`Phase A migration ${dryRun ? '(dry-run) ' : ''}starting…`);
	console.log(`  API base: ${apiBase}`);
	console.log(`  DB: ${db}`);
	console.log(`  Schema: ${schemaPath}`);

	const out = await runPhaseA({
		apiBase,
		db,
		apiKey,
		schemaPath,
		reportsDir,
		dryRun
	});

	console.log(`\nReport: ${out.reportPaths.md}`);
	console.log(`        ${out.reportPaths.json}`);
	console.log(
		`\nSummary: ${out.result.createdTypes.length} type(s) created, ${out.result.addedProperties.length} property(ies) added, ${out.result.failed.length} failure(s)`
	);
	process.exit(out.exitCode);
}

// Run main only when invoked directly via tsx
const isMain = process.argv[1]?.endsWith('2026-05-19-phase-a.ts');
if (isMain) {
	main().catch((err) => {
		console.error('Fatal:', err);
		process.exit(1);
	});
}
```

- [ ] **Step 4: Run the E2E test to verify it passes**

Run:
```bash
pnpm test:unit scripts/migrations/2026-05-19-phase-a.spec.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Run the full test suite**

Run:
```bash
pnpm test:unit
```

Expected: all migration tests pass; existing build-config + build-output tests still pass.

- [ ] **Step 6: Run `pnpm check` (type-check the whole repo)**

Run:
```bash
pnpm check
```

Expected: 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrations/2026-05-19-phase-a.ts scripts/migrations/2026-05-19-phase-a.spec.ts
git commit -m "feat(migration): Phase A CLI entry point with E2E test

- runPhaseA orchestrates schema load, auth, db state, diff, exec, report
- fetchDbState lists existing entity types + their property names
- Schema-source SHA-256 hashed for report provenance
- Report file naming: dry-run-<timestamp> or <timestamp>
- main() honors ENTU_API_BASE, ENTU_DB, ENTU_API_KEY, V4E_SCHEMA_PATH
- 3 vitest E2E tests with mocked fetch + temp fs reports dir"
```

---

## Task 8: Dry-run against live polyphony db

**Not a code task** — operational validation before merging.

- [ ] **Step 1: Load credentials + run dry-run**

Run:
```bash
source ~/.config/mvox/credentials.env
pnpm migrate:phase-a:dry
```

Expected: prints schema/db/api info, lists what would be created, exits 0. Writes report files to `scripts/migrations/reports/dry-run-*.json` and `.md`.

- [ ] **Step 2: Inspect the dry-run report**

Run:
```bash
cat scripts/migrations/reports/dry-run-*-phase-a-*.md | less
```

Expected: human-readable list of every type/property the script would add. Sanity-check against v4E schema by hand.

- [ ] **Step 3: Attach the markdown dry-run report to the PR description**

When opening the PR (Task 9), paste the contents of the dry-run `.md` report into the PR body so Bentham + PO can review the planned changes.

- [ ] **Step 4: Do NOT commit the dry-run report**

Run:
```bash
git status
```

Expected: `scripts/migrations/reports/dry-run-*` files appear as untracked. Leave them untracked; only the actual execution report gets committed (Task 10).

---

## Task 9: Open PR + Bentham review handoff

**Not a code task** — process step.

- [ ] **Step 1: Push branch + open PR**

Run:
```bash
git push -u origin <branch-name>
gh pr create --title "feat(migration): Phase A additive migration script" --body "$(cat <<'EOF'
## Summary
- Single autonomous TypeScript script that brings polyphony's live Entu db up to v4E schema, additive only
- Idempotent, dependency-sorted, structured JSON + markdown report
- Spec: docs/migration/specs/2026-05-19-phase-a-design.md
- Plan: docs/migration/specs/2026-05-19-phase-a-plan.md

## Test plan
- [x] All vitest unit tests pass (entu-client × 5, schema-loader × 4, diff × 4, executor × 4, reporter × 4)
- [x] E2E tests pass (3 scenarios: dry-run, happy path, failure capture)
- [x] pnpm check passes (0 type errors)
- [ ] Bentham reviews script + spec + dry-run output
- [ ] PO greenlights live execution

## Dry-run output
<paste contents of scripts/migrations/reports/dry-run-*-phase-a-*.md here>

EOF
)"
```

- [ ] **Step 2: Hand off to Bentham**

Send Bentham a SendMessage including: PR URL, the spec file path, the plan file path, the dry-run report (attached or quoted), and an explicit ask to review the *plan* against the spec + the *implementation* against the plan.

- [ ] **Step 3: Wait for Bentham GREEN**

If Bentham returns RED or YELLOW, address feedback per his comments. New tests if needed (Tallis), implementation fixes (Josquin). Re-iterate until GREEN.

- [ ] **Step 4: PO greenlights execution**

After Bentham GREEN, PO reviews the dry-run output one more time and confirms execution should proceed.

- [ ] **Step 5: Squash-merge to main (Josquin)**

Per common-prompt.md merge procedure:
```bash
git checkout main
git pull
git merge --squash <branch-name>
git commit -m "feat(migration): Phase A additive script"
git push
gh pr close <pr-number>
git push origin --delete <branch-name>
```

(Note: the prepare-commit-msg hook adds the Co-authored-by trailer automatically.)

---

## Task 10: Execute Phase A live

**Not a code task** — the actual migration execution + reporting.

- [ ] **Step 1: Pull latest main locally**

Run:
```bash
git checkout main && git pull
```

- [ ] **Step 2: Execute against live polyphony db, PO observing**

Run (with PO present):
```bash
source ~/.config/mvox/credentials.env
pnpm migrate:phase-a
```

Expected: script prints progress, writes report files, exits 0 (or 1 if anything failed). If exit 1, do NOT panic — read the report, identify which operations failed, fix-forward per the spec.

- [ ] **Step 3: Inspect the executed report**

Run:
```bash
ls -lt scripts/migrations/reports/ | head -3
cat scripts/migrations/reports/<latest-non-dry-run>.md
```

Expected: counts match dry-run expectations; failed = 0 (or known-and-acceptable failures).

- [ ] **Step 4: Commit the executed report to main**

Run:
```bash
git add scripts/migrations/reports/2026-05-19-phase-a-*.json scripts/migrations/reports/2026-05-19-phase-a-*.md
git commit -m "chore(migration): Phase A executed — report artifacts

- Executed against live polyphony db on YYYY-MM-DD HH:MM
- N types created, M properties added, 0 failed
- See report files for full detail"
git push
```

(Make sure to include only the actual-execution report files, not any leftover `dry-run-*` files.)

- [ ] **Step 5: Update task #6 status + memory**

Mark the team task list:
- Task #6 progresses from "Phase A in_progress" to "Phase A complete; Phase B/C/D ahead"

Update `teams/mvox-dev/memory/team-lead.md` with a CHECKPOINT entry capturing what was done + what to do next (per the post-execution touch-save plan if any formula properties were deferred).

If any new gotchas surfaced during execution, append to handbook §3 or §5.

- [ ] **Step 6: Unblock dependent tasks**

Task #4 (CHORE-5 BFF skeleton) is now unblocked — it can be picked up as the next mvox feature work. Update its task description: remove the BLOCKED marker.

---

## Self-Review Notes

Run through the spec → plan cross-check:
- ✅ Single autonomous script — Task 7 entry point
- ✅ Auto-diff schema.json ↔ live db — Tasks 3 + 4 + 7's `fetchDbState`
- ✅ Idempotency — diff naturally skips existing (Task 4); executor records "skipped" only for explicit skip semantics (currently empty — see open item below)
- ✅ Fix-forward (no rollback mode) — never built into executor
- ✅ Autonomous execution + structured report — Tasks 5 + 6 + 7
- ✅ Single mvox repo location — all paths under `scripts/migrations/`
- ✅ Formula property handling deferred — Task 5 executor tracks `formulaTouchSaveDeferred`
- ✅ TDD chain — every code task has RED → GREEN → commit
- ✅ Dry-run mode — Task 5 executor + Task 7 CLI flag
- ✅ PR workflow + execution gate — Tasks 8 + 9 + 10

**Open implementation note:** The `skipped` array in `ExecutionResult` is currently only populated by the diff step (which silently omits already-present items rather than emitting an explicit "skip"). If we want richer "skipped because already exists" reporting, the diff could be changed to emit `SKIP_*` ops which the executor passes through. For Phase A v1 this is fine — the report shows what was added; what wasn't added is "everything else in v4E that the db already had," which the dry-run output can express by diffing v4E against the dry-run's `wouldCreate*` lists.

(*MVOX:Palestrina*)
