# CHORE-67 — Wire /library to real Entu data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace /library's mock catalog (and the GH #71 over-fetch) with org-scoped real Entu data, rendered as a master-detail unit: a sticky compact index on the left + a full-height scrollable column of work paperstacks on the right, with nested edition subcards. Librarian-only gating; non-librarian-org selections on /library redirect to /.

**Architecture:** Path C semantics (browser-direct Entu calls with localStorage JWT, same as CHORE-66 userStore). New `librarySectionStore` derives from `$selectedOrgStore` and hydrates 3 parallel Entu queries (library entity + works under library + editions under library) into a discriminated-union state. New library components compose the master-detail visual on top of the existing CHORE-60 UI kit (DeskSurface, etc.). All scrollbars hidden globally.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript strict, Tailwind v4, Vitest. Entu API via the existing `ENTU_API_BASE` + `PUBLIC_ENTU_DB` pattern from `src/lib/auth/userStore.ts`.

**Spec:** `docs/superpowers/specs/2026-05-24-chore-67-library-real-data-design.md`

---

## Branch + setup

### Task 1: Create feature branch

**Files:** none (branch only)

- [ ] **Step 1: Verify clean state and create branch**

```bash
cd /home/michelek/workspace
git checkout main
git pull --ff-only
git status --short  # expect empty
git checkout -b chore/library-real-data
git push -u origin chore/library-real-data
git branch --show-current  # expect chore/library-real-data
```

- [ ] **Step 2: Set the pre-commit branch-intent env var**

```bash
export MVOX_EXPECTED_BRANCH=chore/library-real-data
```

This must be set in every shell session that commits to this branch. The pre-commit hook (`.git/hooks/pre-commit`) refuses to commit if `git branch --show-current` doesn't match `$MVOX_EXPECTED_BRANCH`.

---

## Pérotin probe — canonical edition-fetch path

### Task 2: Verify edition entity placement in v4E

**Files:** none (read-only probe + scratchpad note)

The spec's data flow assumes one of two strategies:
- **(a)** Editions are direct children of the library (single query under library, group-by `edition.work`)
- **(b)** Editions are children of works (N queries, one per work)

Pérotin probes the seeded librarian-bundle (EFK Library `6a12036c4ff8277cd4306b26`) to confirm which path matches reality before Tallis writes RED.

- [ ] **Step 1: Pérotin probes EFK Library structure**

Read-only Entu queries with Pérotin's own API key (no IP-bound issue for him). Verify:
- What is `_parent` for entities of `_type.string=edition` under the EFK Library?
- Are editions direct children of `6a12036c4ff8277cd4306b26` (library), or of individual work entities?

Sample probe commands (run from Pérotin's session):
```bash
set -a; . ~/.config/mvox/credentials.env; set +a
# Find an edition under EFK library somehow — depends on structure
curl -sH "Authorization: Bearer $ENTU_API_KEY" \
  "https://api.entu.app/polyphony/entity?_type.string=edition&limit=3&props=_parent,name" | jq
# Pick any edition's _parent.reference, look up that entity's type
curl -sH "Authorization: Bearer $ENTU_API_KEY" \
  "https://api.entu.app/polyphony/entity/<parent_id>?props=_type,name" | jq
```

- [ ] **Step 2: Pérotin reports back which strategy applies**

Pérotin sends a SendMessage to team-lead with verdict: "strategy (a)" or "strategy (b)". This determines the URL pattern in Task 7 (works fetch) and Task 9 (editions fetch).

- [ ] **Step 3: Pin the choice in the spec**

Team-lead updates the spec's "Data flow" section (search for "Pérotin verifies the canonical path") with the confirmed strategy. Tallis reads this before writing RED.

---

## i18n keys upfront (per L100)

### Task 3: Comenius adds new library_* keys to all 4 locales

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/et.json`
- Modify: `messages/lv.json`
- Modify: `messages/uk.json`

i18n setup precedes consuming-page tasks per L100 (i18n-key-tasks-precede-consuming-page-tasks). Otherwise Byrd's GREEN tasks would reference `m.library_*` keys that don't exist, blocking the per-commit-GREEN discipline.

- [ ] **Step 1: Comenius adds new keys to `messages/en.json`**

Add these keys (use the existing JSON structure):

```json
{
  "library_master_count": "{n, plural, one {1 work} other {{n} works}}",
  "library_master_sort_label": "composer ↑",
  "library_empty_marginalia": "Nothing's catalogued yet — add a first work to start the shelf.",
  "library_work_eyebrow_metadata": "Metadata",
  "library_work_eyebrow_editions": "Editions · {n}",
  "library_work_eyebrow_in_view": "in view",
  "library_field_voicing": "Voicing",
  "library_field_language": "Language",
  "library_field_year": "Year",
  "library_field_isbn": "ISBN",
  "library_field_publisher": "Publisher"
}
```

- [ ] **Step 2: Comenius adds translations to `et.json`, `lv.json`, `uk.json`**

Use semantic translations, not literal. Examples for et (Estonian):

```json
{
  "library_master_count": "{n, plural, one {1 teos} other {{n} teost}}",
  "library_master_sort_label": "helilooja ↑",
  "library_empty_marginalia": "Veel pole midagi kataloogis — alusta riiulit esimese teosega.",
  "library_work_eyebrow_metadata": "Andmed",
  "library_work_eyebrow_editions": "Väljaanded · {n}",
  "library_work_eyebrow_in_view": "vaates",
  "library_field_voicing": "Häälestus",
  "library_field_language": "Keel",
  "library_field_year": "Aasta",
  "library_field_isbn": "ISBN",
  "library_field_publisher": "Kirjastaja"
}
```

Comenius makes equivalent choices for lv and uk based on team i18n-conventions.md.

- [ ] **Step 3: Verify paraglide regenerates**

```bash
pnpm check
```

Expected: 0 errors, 0 warnings. (Paraglide auto-regenerates `src/lib/paraglide/messages.js` on check.)

- [ ] **Step 4: Run unit tests**

```bash
pnpm test
```

Expected: existing 468 tests pass. No new tests added by this task.

- [ ] **Step 5: Commit**

```bash
git add messages/
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "i18n(#chore-67): add library_* keys for master-detail catalog · 4 locales"
git push
```

---

## Types and data layer

### Task 4: Define library-entu types

**Files:**
- Create: `src/lib/types/library-entu.ts`

These types represent Entu-shaped data, distinct from the existing mock types in `src/lib/types/library.ts` which represent UI-fixture shapes for the task stacks.

- [ ] **Step 1: Create the types file**

```ts
// src/lib/types/library-entu.ts

/**
 * Live v4E entity shapes for the library subtree.
 * Distinct from the mock UI shapes in src/lib/types/library.ts which
 * back the 3 task stacks (Returns / Overdue / Pull) and stay on mock
 * data for this CHORE.
 */

export interface EntuLibrary {
	id: string;            // _id of the library entity
	name: string;          // name[0].string
	orgId: string;         // _parent.reference (the org the library belongs to)
	editorIds: string[];   // _editor.*.reference — list of personIds with editor rights
}

export interface EntuWork {
	id: string;
	libraryId: string;     // _parent.reference (the library)
	composer: string;
	title: string;
	voicing?: string;
	language?: string;
	year?: number;
}

export interface EntuEdition {
	id: string;
	workId: string;        // the work this edition belongs to (per Pérotin's strategy probe)
	label: string;
	year?: number;
	publisher?: string;
	isbn?: string;
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
pnpm check
```

Expected: 0 errors. No tests for pure type definitions.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/library-entu.ts
git commit -m "types(#chore-67): EntuLibrary/EntuWork/EntuEdition shapes for live data"
git push
```

---

### Task 5: Tallis RED — librarian rights check + hydrateLibrary skeleton

**Files:**
- Create: `src/lib/library/hydrateLibrary.spec.ts`

The function `hydrateLibrary(orgId, personId)` returns either:
- `{ status: 'no-rights' }` when no library exists OR the user lacks `_editor` on it
- `{ status: 'empty', library: EntuLibrary }` when library exists with 0 works
- `{ status: 'ready', library, works, editionsByWork }` for the happy path

This RED locks the contract.

- [ ] **Step 1: Write the failing spec**

```ts
// src/lib/library/hydrateLibrary.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hydrateLibrary } from './hydrateLibrary';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'test-env-db' }));

const TOKEN = 'fake.jwt.token';
const ORG_ID = '69c7f8718489bfcb0e81b065';        // EFK
const PERSON_ID = '69bcfd8e9c031ab8e6ce8079';     // PO
const LIBRARY_ID = '6a12036c4ff8277cd4306b26';

function makeLibraryResponse(opts: { editors: string[] }) {
	return {
		entities: [
			{
				_id: LIBRARY_ID,
				name: [{ string: 'EFK Library' }],
				_parent: [{ reference: ORG_ID }],
				_editor: opts.editors.map((r) => ({ reference: r })),
			},
		],
	};
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.stubGlobal('fetch', vi.fn());
});

describe('hydrateLibrary', () => {
	it('returns no-rights when the org has no library entity', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ entities: [] }),  // no library
		});
		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('no-rights');
	});

	it('returns no-rights when the user is not _editor on the library', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => makeLibraryResponse({ editors: ['other-person-id'] }),
		});
		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('no-rights');
	});

	it('returns empty when library exists, user is editor, but 0 works', async () => {
		(globalThis.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeLibraryResponse({ editors: [PERSON_ID] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ entities: [] }),  // 0 works
			});
		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('empty');
		if (result.status === 'empty') {
			expect(result.library.id).toBe(LIBRARY_ID);
		}
	});
});
```

- [ ] **Step 2: Run the spec — expect FAIL**

```bash
pnpm test src/lib/library/hydrateLibrary.spec.ts
```

Expected: ERROR — module `./hydrateLibrary` does not exist.

- [ ] **Step 3: Commit**

```bash
git add src/lib/library/hydrateLibrary.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "test(#chore-67): RED for hydrateLibrary — rights check + empty case"
git push
```

---

### Task 6: Byrd GREEN — hydrateLibrary stub for rights + empty cases

**Files:**
- Create: `src/lib/library/hydrateLibrary.ts`

Implement just enough to pass Task 5's specs. The works-fetch and editions-fetch come in later tasks; for now we hardcode `status: 'empty'` when the works query returns 0.

- [ ] **Step 1: Create the implementation**

```ts
// src/lib/library/hydrateLibrary.ts
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { ENTU_API_BASE } from '$lib/entu-config';
import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';

export type LibraryHydrationResult =
	| { status: 'no-rights' }
	| { status: 'empty'; library: EntuLibrary }
	| {
			status: 'ready';
			library: EntuLibrary;
			works: EntuWork[];
			editionsByWork: Map<string, EntuEdition[]>;
	  }
	| { status: 'error'; reason: string };

interface HydrateArgs {
	orgId: string;
	personId: string;
	token: string;
}

interface EntuLibraryRaw {
	_id: string;
	name?: Array<{ string: string }>;
	_parent?: Array<{ reference: string }>;
	_editor?: Array<{ reference: string }>;
}

export async function hydrateLibrary(args: HydrateArgs): Promise<LibraryHydrationResult> {
	const { orgId, personId, token } = args;
	const headers = { Authorization: `Bearer ${token}` };
	const base = `${ENTU_API_BASE}${PUBLIC_ENTU_DB}`;

	// 1. Resolve library entity
	const libRes = await fetch(
		`${base}/entity?_type.string=library&_parent.reference=${orgId}&props=name,_editor,_parent`,
		{ headers },
	);
	if (!libRes.ok) return { status: 'error', reason: `library fetch ${libRes.status}` };
	const libBody = (await libRes.json()) as { entities?: EntuLibraryRaw[] };
	const libRaw = libBody.entities?.[0];
	if (!libRaw) return { status: 'no-rights' };

	const editorIds = (libRaw._editor ?? []).map((e) => e.reference);
	if (!editorIds.includes(personId)) {
		return { status: 'no-rights' };
	}

	const library: EntuLibrary = {
		id: libRaw._id,
		name: libRaw.name?.[0]?.string ?? '',
		orgId: libRaw._parent?.[0]?.reference ?? orgId,
		editorIds,
	};

	// 2. Query works under library
	const worksRes = await fetch(
		`${base}/entity?_type.string=work&_parent.reference=${library.id}&props=name,composer,voicing,language,year&limit=200`,
		{ headers },
	);
	if (!worksRes.ok) return { status: 'error', reason: `works fetch ${worksRes.status}` };
	const worksBody = (await worksRes.json()) as { entities?: any[] };
	const worksRaw = worksBody.entities ?? [];

	if (worksRaw.length === 0) {
		return { status: 'empty', library };
	}

	// Works + editions come in Task 7 + 8. For now return empty.
	// (RED for ready-case lands in Task 7.)
	return { status: 'empty', library };
}
```

- [ ] **Step 2: Run the spec — expect PASS**

```bash
pnpm test src/lib/library/hydrateLibrary.spec.ts
```

Expected: 3/3 pass.

- [ ] **Step 3: Run the full suite**

```bash
pnpm test
```

Expected: existing 468 + 3 new = 471 pass.

- [ ] **Step 4: Lint + check**

```bash
pnpm check
pnpm lint
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/library/hydrateLibrary.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): hydrateLibrary — rights check + empty-library detection"
git push
```

---

### Task 7: Tallis RED — works mapping in hydrateLibrary

**Files:**
- Modify: `src/lib/library/hydrateLibrary.spec.ts`

- [ ] **Step 1: Add specs for the ready case (works present, no editions yet)**

Append to `hydrateLibrary.spec.ts`:

```ts
describe('hydrateLibrary — works mapping', () => {
	function makeWorksResponse(works: Array<{ id: string; composer: string; title: string }>) {
		return {
			entities: works.map((w) => ({
				_id: w.id,
				_parent: [{ reference: LIBRARY_ID }],
				name: [{ string: w.title }],
				composer: [{ string: w.composer }],
				voicing: [{ string: 'SATB' }],
				language: [{ string: 'Latin' }],
				year: [{ number: 1947 }],
			})),
		};
	}

	it('returns ready with mapped works when library has entries', async () => {
		(globalThis.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeLibraryResponse({ editors: [PERSON_ID] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () =>
					makeWorksResponse([
						{ id: 'work-a', composer: 'Duruflé', title: 'Requiem' },
						{ id: 'work-b', composer: 'Pärt', title: 'Da pacem' },
					]),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ entities: [] }),  // editions placeholder
			});

		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('ready');
		if (result.status === 'ready') {
			expect(result.works).toHaveLength(2);
			expect(result.works[0]).toMatchObject({ id: 'work-a', composer: 'Duruflé', title: 'Requiem' });
		}
	});
});
```

- [ ] **Step 2: Run — expect FAIL (current impl returns 'empty' when works exist)**

```bash
pnpm test src/lib/library/hydrateLibrary.spec.ts
```

Expected: 1 failure — `expected 'empty' to be 'ready'`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/library/hydrateLibrary.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "test(#chore-67): RED for works mapping in hydrateLibrary"
git push
```

---

### Task 8: Byrd GREEN — implement works mapping

**Files:**
- Modify: `src/lib/library/hydrateLibrary.ts`

- [ ] **Step 1: Replace the works section in hydrateLibrary**

Replace the block that starts with `// 2. Query works under library` through `return { status: 'empty', library };` (the final placeholder) with:

```ts
	// 2. Query works under library
	const worksRes = await fetch(
		`${base}/entity?_type.string=work&_parent.reference=${library.id}&props=name,composer,voicing,language,year&limit=200`,
		{ headers },
	);
	if (!worksRes.ok) return { status: 'error', reason: `works fetch ${worksRes.status}` };
	const worksBody = (await worksRes.json()) as { entities?: any[] };
	const worksRaw = worksBody.entities ?? [];

	if (worksRaw.length === 0) {
		return { status: 'empty', library };
	}

	const works: EntuWork[] = worksRaw
		.map((w): EntuWork => ({
			id: w._id,
			libraryId: library.id,
			composer: w.composer?.[0]?.string ?? '',
			title: w.name?.[0]?.string ?? '',
			voicing: w.voicing?.[0]?.string,
			language: w.language?.[0]?.string,
			year: w.year?.[0]?.number,
		}))
		.sort((a, b) => a.composer.localeCompare(b.composer));

	// 3. Editions fetch lands in Task 9. For now editionsByWork is empty.
	const editionsByWork = new Map<string, EntuEdition[]>();
	works.forEach((w) => editionsByWork.set(w.id, []));

	return { status: 'ready', library, works, editionsByWork };
```

- [ ] **Step 2: Run — expect PASS**

```bash
pnpm test src/lib/library/hydrateLibrary.spec.ts
```

Expected: 4/4 pass.

- [ ] **Step 3: Full suite + gates**

```bash
pnpm test && pnpm check && pnpm lint
```

Expected: all clean. Total tests 472.

- [ ] **Step 4: Commit**

```bash
git add src/lib/library/hydrateLibrary.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): map Entu works to EntuWork[] sorted composer-alpha"
git push
```

---

### Task 9: Tallis RED + Byrd GREEN — editions mapping

**Files:**
- Modify: `src/lib/library/hydrateLibrary.spec.ts`
- Modify: `src/lib/library/hydrateLibrary.ts`

The exact fetch strategy depends on Pérotin's Task 2 verdict. **This task assumes strategy (a)**: editions are direct children of the library, fetched in a single query, then grouped by `edition._parent` or by an `edition.work.reference` property. **If Pérotin reports strategy (b)** (editions are children of works), this task swaps to N parallel fetches with `Promise.all`.

- [ ] **Step 1: Tallis adds editions spec (strategy a)**

Append to `hydrateLibrary.spec.ts`:

```ts
describe('hydrateLibrary — editions grouped by work', () => {
	it('returns editionsByWork map populated from the editions fetch', async () => {
		(globalThis.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeLibraryResponse({ editors: [PERSON_ID] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeWorksResponse([
					{ id: 'work-a', composer: 'Duruflé', title: 'Requiem' },
				]),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'ed-1',
							name: [{ string: 'Peters · full score' }],
							year: [{ number: 1991 }],
							isbn: [{ string: 'EP-8421' }],
							publisher: [{ string: 'Peters' }],
							work: [{ reference: 'work-a' }],
						},
						{
							_id: 'ed-2',
							name: [{ string: 'Durand · organ reduction' }],
							year: [{ number: 1948 }],
							isbn: [{ string: 'DUR-992' }],
							work: [{ reference: 'work-a' }],
						},
					],
				}),
			});

		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('ready');
		if (result.status === 'ready') {
			const editionsForA = result.editionsByWork.get('work-a');
			expect(editionsForA).toHaveLength(2);
			expect(editionsForA?.[0]).toMatchObject({
				id: 'ed-1',
				label: 'Peters · full score',
				year: 1991,
				isbn: 'EP-8421',
			});
		}
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/lib/library/hydrateLibrary.spec.ts
```

Expected: `expected 0 to be 2` on the editions length assertion.

- [ ] **Step 3: Byrd GREEN — implement editions fetch + groupBy**

Replace the placeholder editions block in `hydrateLibrary.ts`:

```ts
	// 3. Query editions under the library (single query; group by edition.work)
	const edsRes = await fetch(
		`${base}/entity?_type.string=edition&_parent.reference=${library.id}&props=name,year,publisher,isbn,work&limit=500`,
		{ headers },
	);
	if (!edsRes.ok) return { status: 'error', reason: `editions fetch ${edsRes.status}` };
	const edsBody = (await edsRes.json()) as { entities?: any[] };
	const edsRaw = edsBody.entities ?? [];

	const editionsByWork = new Map<string, EntuEdition[]>();
	works.forEach((w) => editionsByWork.set(w.id, []));
	edsRaw.forEach((e) => {
		const workId = e.work?.[0]?.reference;
		if (!workId) return;
		const edition: EntuEdition = {
			id: e._id,
			workId,
			label: e.name?.[0]?.string ?? '',
			year: e.year?.[0]?.number,
			publisher: e.publisher?.[0]?.string,
			isbn: e.isbn?.[0]?.string,
		};
		const list = editionsByWork.get(workId) ?? [];
		list.push(edition);
		editionsByWork.set(workId, list);
	});

	return { status: 'ready', library, works, editionsByWork };
```

(Remove the temporary `editionsByWork` placeholder from Task 8.)

**If Pérotin's verdict was strategy (b)**: replace step 3 with N parallel fetches:

```ts
	const edPromises = works.map((w) =>
		fetch(`${base}/entity?_type.string=edition&_parent.reference=${w.id}&props=name,year,publisher,isbn`, { headers })
			.then((r) => (r.ok ? r.json() : { entities: [] }))
			.then((body: any) => ({ workId: w.id, raws: body.entities ?? [] })),
	);
	const edResults = await Promise.all(edPromises);
	const editionsByWork = new Map<string, EntuEdition[]>();
	edResults.forEach(({ workId, raws }) => {
		editionsByWork.set(
			workId,
			raws.map((e: any) => ({
				id: e._id,
				workId,
				label: e.name?.[0]?.string ?? '',
				year: e.year?.[0]?.number,
				publisher: e.publisher?.[0]?.string,
				isbn: e.isbn?.[0]?.string,
			})),
		);
	});
```

- [ ] **Step 4: Verify PASS + full suite**

```bash
pnpm test src/lib/library/hydrateLibrary.spec.ts
pnpm test && pnpm check && pnpm lint && pnpm build
```

Expected: 5/5 spec pass; 473 total pass; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/library/hydrateLibrary.spec.ts src/lib/library/hydrateLibrary.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): editions fetch + groupBy work"
git push
```

---

### Task 10: librarySectionStore — derived store wrapping hydrateLibrary

**Files:**
- Create: `src/lib/library/libraryStore.ts`
- Create: `src/lib/library/libraryStore.spec.ts`

The store wraps `hydrateLibrary` and exposes a writable that updates as `$selectedOrgStore` changes. Also handles the loading/error states the spec calls for.

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/library/libraryStore.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { librarySectionStore, hydrateLibrarySection } from './libraryStore';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'test-env-db' }));
vi.mock('$lib/auth/storage', () => ({ getToken: () => 'fake.token' }));

beforeEach(() => {
	vi.restoreAllMocks();
	vi.stubGlobal('fetch', vi.fn());
	librarySectionStore.set({ status: 'loading' });
});

describe('librarySectionStore', () => {
	it('starts in loading state', () => {
		expect(get(librarySectionStore).status).toBe('loading');
	});

	it('transitions to no-rights when hydrateLibrary returns no-rights', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ entities: [] }),
		});
		await hydrateLibrarySection({ orgId: 'org-1', personId: 'person-1' });
		expect(get(librarySectionStore).status).toBe('no-rights');
	});

	it('transitions to error when the token is missing', async () => {
		// override the mock to return null
		const storage = await import('$lib/auth/storage');
		vi.spyOn(storage, 'getToken').mockReturnValue(null);
		await hydrateLibrarySection({ orgId: 'org-1', personId: 'person-1' });
		expect(get(librarySectionStore).status).toBe('error');
	});
});
```

- [ ] **Step 2: Run — expect FAIL (module doesn't exist)**

```bash
pnpm test src/lib/library/libraryStore.spec.ts
```

- [ ] **Step 3: Byrd GREEN**

```ts
// src/lib/library/libraryStore.ts
import { writable, type Writable } from 'svelte/store';
import { getToken } from '$lib/auth/storage';
import { hydrateLibrary, type LibraryHydrationResult } from './hydrateLibrary';

export type LibrarySectionState =
	| { status: 'loading' }
	| LibraryHydrationResult;

export const librarySectionStore: Writable<LibrarySectionState> = writable({ status: 'loading' });

export async function hydrateLibrarySection(args: { orgId: string; personId: string }): Promise<void> {
	librarySectionStore.set({ status: 'loading' });
	const token = getToken();
	if (!token) {
		librarySectionStore.set({ status: 'error', reason: 'no token' });
		return;
	}
	const result = await hydrateLibrary({ ...args, token });
	librarySectionStore.set(result);
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test src/lib/library/libraryStore.spec.ts
pnpm test && pnpm check && pnpm lint
```

Expected: 3 store specs pass; total 476 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/library/libraryStore.ts src/lib/library/libraryStore.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): librarySectionStore wraps hydrateLibrary with loading + error"
git push
```

---

## Components — leaf-up

### Task 11: LibraryEditionCard — the innermost subcard

**Files:**
- Create: `src/lib/components/library/LibraryEditionCard.svelte`
- Create: `src/lib/components/library/LibraryEditionCard.spec.ts`

A single edition rendered as a tinted single-sheet subcard. No stack-behind shadow.

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/library/LibraryEditionCard.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import LibraryEditionCard from './LibraryEditionCard.svelte';
import type { EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const edition: EntuEdition = {
	id: 'ed-1',
	workId: 'work-a',
	label: 'Peters · full score',
	year: 1991,
	publisher: 'Peters',
	isbn: 'EP-8421',
};

describe('LibraryEditionCard', () => {
	it('renders the label as the title', () => {
		render(LibraryEditionCard, { props: { edition } });
		expect(screen.getByText('Peters · full score')).toBeTruthy();
	});

	it('renders year in mono', () => {
		render(LibraryEditionCard, { props: { edition } });
		expect(screen.getByText('1991')).toBeTruthy();
	});

	it('renders ISBN if present', () => {
		render(LibraryEditionCard, { props: { edition } });
		expect(screen.getByText('EP-8421')).toBeTruthy();
	});

	it('omits ISBN row when ISBN is missing', () => {
		const noIsbn = { ...edition, isbn: undefined };
		render(LibraryEditionCard, { props: { edition: noIsbn } });
		expect(screen.queryByText('EP-8421')).toBeNull();
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/lib/components/library/LibraryEditionCard.spec.ts
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/library/LibraryEditionCard.svelte -->
<script lang="ts">
	import type { EntuEdition } from '$lib/types/library-entu';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		edition: EntuEdition;
	}
	let { edition }: Props = $props();
</script>

<div class="ed-card">
	<div class="ed-h">
		<div class="ed-label">{edition.label}</div>
		{#if edition.year !== undefined}
			<div class="ed-year">{edition.year}</div>
		{/if}
	</div>
	{#if edition.isbn}
		<div class="ed-row">
			<span class="ed-row-label">{m.library_field_isbn()}</span>
			<span class="ed-row-value mono">{edition.isbn}</span>
		</div>
	{/if}
	{#if edition.publisher}
		<div class="ed-row">
			<span class="ed-row-label">{m.library_field_publisher()}</span>
			<span class="ed-row-value">{edition.publisher}</span>
		</div>
	{/if}
</div>

<style>
	.ed-card {
		background: #f4ead8;
		border: 1px solid #b8a986;
		padding: 7px 10px;
		font-size: 10px;
		box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.1);
	}
	.ed-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 3px;
	}
	.ed-label {
		font-weight: 700;
		font-size: 11px;
	}
	.ed-year {
		font-size: 9px;
		color: #6a5230;
		font-family: 'JetBrains Mono', monospace;
	}
	.ed-row {
		display: flex;
		gap: 10px;
		font-size: 10px;
		color: #4a3a1f;
	}
	.ed-row-label {
		color: #998a6a;
	}
	.mono {
		font-family: 'JetBrains Mono', monospace;
	}
</style>
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm test src/lib/components/library/LibraryEditionCard.spec.ts
pnpm test && pnpm check && pnpm lint
```

Expected: 4 specs pass; total 480.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/library/LibraryEditionCard.svelte src/lib/components/library/LibraryEditionCard.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): LibraryEditionCard — tinted subcard for nested editions"
git push
```

---

### Task 12: LibraryWorkPaperStack — work card with editions inside

**Files:**
- Create: `src/lib/components/library/LibraryWorkPaperStack.svelte`
- Create: `src/lib/components/library/LibraryWorkPaperStack.spec.ts`

The outer paperstack containing metadata + N edition subcards. Has a `data-work-id` attribute for IntersectionObserver.

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/library/LibraryWorkPaperStack.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import LibraryWorkPaperStack from './LibraryWorkPaperStack.svelte';
import type { EntuWork, EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const work: EntuWork = {
	id: 'work-a',
	libraryId: 'lib-1',
	composer: 'Maurice Duruflé',
	title: 'Requiem Op. 9',
	voicing: 'SATB + org.',
	language: 'Latin',
	year: 1947,
};

const editions: EntuEdition[] = [
	{ id: 'ed-1', workId: 'work-a', label: 'Peters · full score', year: 1991 },
	{ id: 'ed-2', workId: 'work-a', label: 'Durand · organ reduction', year: 1948 },
];

describe('LibraryWorkPaperStack', () => {
	it('renders composer and title', () => {
		const { container } = render(LibraryWorkPaperStack, { props: { work, editions, active: false } });
		expect(container.textContent).toContain('Maurice Duruflé');
		expect(container.textContent).toContain('Requiem Op. 9');
	});

	it('renders all editions as subcards', () => {
		render(LibraryWorkPaperStack, { props: { work, editions, active: false } });
		expect(screen.getByText('Peters · full score')).toBeTruthy();
		expect(screen.getByText('Durand · organ reduction')).toBeTruthy();
	});

	it('exposes data-work-id on the outer element', () => {
		const { container } = render(LibraryWorkPaperStack, { props: { work, editions, active: false } });
		const stack = container.querySelector('[data-work-id="work-a"]');
		expect(stack).not.toBeNull();
	});

	it('applies active class when active=true', () => {
		const { container } = render(LibraryWorkPaperStack, { props: { work, editions, active: true } });
		const stack = container.querySelector('.work-stack.active');
		expect(stack).not.toBeNull();
	});

	it('does not show active class when active=false', () => {
		const { container } = render(LibraryWorkPaperStack, { props: { work, editions, active: false } });
		const stack = container.querySelector('.work-stack.active');
		expect(stack).toBeNull();
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/lib/components/library/LibraryWorkPaperStack.spec.ts
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/library/LibraryWorkPaperStack.svelte -->
<script lang="ts">
	import type { EntuWork, EntuEdition } from '$lib/types/library-entu';
	import LibraryEditionCard from './LibraryEditionCard.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		work: EntuWork;
		editions: EntuEdition[];
		active: boolean;
	}
	let { work, editions, active }: Props = $props();
</script>

<div class="work-stack" class:active data-work-id={work.id} id={`work-${work.id}`}>
	<div class="work-h">
		<div class="work-title">{work.composer} — <em>{work.title}</em></div>
		<div class="work-tag">
			{active ? m.library_work_eyebrow_in_view() : 'Work'}
		</div>
	</div>
	<div class="work-meta">
		{#if work.voicing}
			<span>{m.library_field_voicing()}</span><span class="mono">{work.voicing}</span>
		{/if}
		{#if work.language}
			<span>{m.library_field_language()}</span><span>{work.language}</span>
		{/if}
		{#if work.year !== undefined}
			<span>{m.library_field_year()}</span><span class="mono">{work.year}</span>
		{/if}
	</div>
	<div class="ed-heading">{m.library_work_eyebrow_editions({ n: editions.length })}</div>
	<div class="ed-list">
		{#each editions as edition (edition.id)}
			<LibraryEditionCard {edition} />
		{/each}
	</div>
</div>

<style>
	.work-stack {
		position: relative;
		background: #fbf9f3;
		border: 1px solid #2a2620;
		padding: 12px 16px 14px;
		box-shadow:
			3px 3px 0 0 #d8c7a4, 3px 3px 0 1px #2a2620,
			6px 6px 0 0 #b8a986, 6px 6px 0 1px #2a2620,
			8px 8px 0 0 rgba(0, 0, 0, 0.2);
	}
	.work-stack.active {
		box-shadow:
			3px 3px 0 0 #f0c997, 3px 3px 0 1px #c47b1b,
			6px 6px 0 0 #d8a266, 6px 6px 0 1px #c47b1b,
			8px 8px 0 0 rgba(0, 0, 0, 0.2);
	}
	.work-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
		border-bottom: 1px dashed #c4b58e;
		padding-bottom: 6px;
	}
	.work-title { font-size: 14px; font-weight: 700; }
	.work-tag {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6a5230;
		font-weight: 600;
	}
	.work-meta {
		display: grid;
		grid-template-columns: 85px 1fr;
		row-gap: 3px;
		font-size: 11px;
		margin-bottom: 10px;
	}
	.work-meta span:first-child { color: #998a6a; }
	.ed-heading {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6a5230;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.ed-list { display: flex; flex-direction: column; gap: 8px; }
	.mono { font-family: 'JetBrains Mono', monospace; }
</style>
```

- [ ] **Step 4: Verify PASS + gates**

```bash
pnpm test src/lib/components/library/LibraryWorkPaperStack.spec.ts
pnpm test && pnpm check && pnpm lint
```

Expected: 5 specs pass; total 485.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/library/LibraryWorkPaperStack.svelte src/lib/components/library/LibraryWorkPaperStack.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): LibraryWorkPaperStack — work card with nested editions"
git push
```

---

### Task 13: LibraryMaster — sticky compact index

**Files:**
- Create: `src/lib/components/library/LibraryMaster.svelte`
- Create: `src/lib/components/library/LibraryMaster.spec.ts`

The left column. Compact rows, sticky, fades right edge to transparent. Click a row → emits `select(workId)`.

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/library/LibraryMaster.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import LibraryMaster from './LibraryMaster.svelte';
import type { EntuWork } from '$lib/types/library-entu';

afterEach(() => cleanup());

const works: EntuWork[] = [
	{ id: 'work-a', libraryId: 'lib-1', composer: 'Duruflé', title: 'Requiem Op. 9' },
	{ id: 'work-b', libraryId: 'lib-1', composer: 'Kreek', title: 'Taaveti laul 141' },
	{ id: 'work-c', libraryId: 'lib-1', composer: 'Pärt', title: 'Da pacem Domine' },
];

describe('LibraryMaster', () => {
	it('renders all work rows in order', () => {
		render(LibraryMaster, { props: { works, selectedWorkId: 'work-b', onselect: () => {} } });
		expect(screen.getByText('Requiem Op. 9')).toBeTruthy();
		expect(screen.getByText('Taaveti laul 141')).toBeTruthy();
		expect(screen.getByText('Da pacem Domine')).toBeTruthy();
	});

	it('renders the count in the header', () => {
		render(LibraryMaster, { props: { works, selectedWorkId: 'work-a', onselect: () => {} } });
		// Expect "3 works" rendering from the plural i18n key
		expect(screen.getByText(/3 works/)).toBeTruthy();
	});

	it('applies sel class to the selected row', () => {
		const { container } = render(LibraryMaster, { props: { works, selectedWorkId: 'work-b', onselect: () => {} } });
		const selectedRow = container.querySelector('[data-work-id="work-b"].row.sel');
		expect(selectedRow).not.toBeNull();
	});

	it('emits onselect with the workId when a row is clicked', async () => {
		const handler = vi.fn();
		const { container } = render(LibraryMaster, { props: { works, selectedWorkId: 'work-a', onselect: handler } });
		const row = container.querySelector('[data-work-id="work-c"]') as HTMLElement;
		await fireEvent.click(row);
		expect(handler).toHaveBeenCalledWith('work-c');
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/lib/components/library/LibraryMaster.spec.ts
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/library/LibraryMaster.svelte -->
<script lang="ts">
	import type { EntuWork } from '$lib/types/library-entu';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		works: EntuWork[];
		selectedWorkId: string | null;
		onselect: (workId: string) => void;
	}
	let { works, selectedWorkId, onselect }: Props = $props();
</script>

<div class="master-col">
	<div class="master-paper">
		<div class="master-hdr">
			<span>{m.library_master_count({ n: works.length })}</span>
			<span>{m.library_master_sort_label()}</span>
		</div>
		{#each works as work (work.id)}
			<button
				type="button"
				class="row"
				class:sel={selectedWorkId === work.id}
				data-work-id={work.id}
				onclick={() => onselect(work.id)}
			>
				<span class="composer">{work.composer}</span>
				<span class="titleit">{work.title}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.master-col {
		position: sticky;
		top: 24px;
	}
	.master-paper {
		border: 1px solid #2a2620;
		border-right: 0;
		box-shadow: 3px 3px 0 0 rgba(0, 0, 0, 0.18);
		background: linear-gradient(
			90deg,
			#fbf9f3 0%,
			#fbf9f3 50%,
			rgba(251, 249, 243, 0.5) 75%,
			rgba(251, 249, 243, 0) 100%
		);
		max-height: calc(100vh - 80px);
		overflow-y: auto;
	}
	.master-hdr {
		padding: 7px 12px;
		font-size: 9px;
		color: #6a5230;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		display: flex;
		justify-content: space-between;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.25);
		position: sticky;
		top: 0;
		background: #fbf9f3;
	}
	.row {
		display: block;
		width: 100%;
		text-align: left;
		padding: 5px 12px;
		border: 0;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.2);
		font-size: 10px;
		cursor: pointer;
		line-height: 1.35;
		background: transparent;
		font-family: inherit;
		color: inherit;
	}
	.composer { font-weight: 600; }
	.titleit { font-style: italic; color: #4a3a1f; margin-left: 4px; }
	.row.sel {
		background: rgba(251, 249, 243, 0.92);
		border-left: 3px solid #c47b1b;
		padding-left: 9px;
	}
</style>
```

- [ ] **Step 4: Verify PASS + gates**

```bash
pnpm test src/lib/components/library/LibraryMaster.spec.ts
pnpm test && pnpm check && pnpm lint
```

Expected: 4 specs pass; total 489.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/library/LibraryMaster.svelte src/lib/components/library/LibraryMaster.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): LibraryMaster — sticky compact index, paper fades to wood"
git push
```

---

### Task 14: LibraryEmptyState — Caveat marginalia for empty libraries

**Files:**
- Create: `src/lib/components/library/LibraryEmptyState.svelte`
- Create: `src/lib/components/library/LibraryEmptyState.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/library/LibraryEmptyState.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import LibraryEmptyState from './LibraryEmptyState.svelte';

afterEach(() => cleanup());

describe('LibraryEmptyState', () => {
	it('renders the empty-library marginalia text', () => {
		render(LibraryEmptyState);
		expect(screen.getByText(/Nothing's catalogued yet/)).toBeTruthy();
	});

	it('uses Caveat font-family on the message', () => {
		const { container } = render(LibraryEmptyState);
		const msg = container.querySelector('.empty-marginalia');
		expect(msg).not.toBeNull();
		// Computed style check is brittle in jsdom; check class is present
		expect(msg?.className).toContain('empty-marginalia');
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/lib/components/library/LibraryEmptyState.spec.ts
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/library/LibraryEmptyState.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="empty-marginalia">
	{m.library_empty_marginalia()}
</div>

<style>
	.empty-marginalia {
		font-family: 'Caveat', cursive;
		color: #f0c6a0;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
		font-size: 16px;
		padding: 20px 0;
		text-align: left;
	}
</style>
```

- [ ] **Step 4: Verify PASS + gates**

```bash
pnpm test src/lib/components/library/LibraryEmptyState.spec.ts
pnpm test && pnpm check && pnpm lint
```

Expected: 2 specs pass; total 491.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/library/LibraryEmptyState.svelte src/lib/components/library/LibraryEmptyState.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): LibraryEmptyState — Caveat marginalia for empty libraries"
git push
```

---

### Task 15: LibraryMasterDetail — orchestrator with IntersectionObserver + URL sync

**Files:**
- Create: `src/lib/components/library/LibraryMasterDetail.svelte`
- Create: `src/lib/components/library/LibraryMasterDetail.spec.ts`

The top-level component. Composes LibraryMaster + the column of LibraryWorkPaperStack. Sets up IntersectionObserver to update `selectedWorkId` as the user scrolls. Click a master row → smooth-scroll detail to that work. URL state via `?work=<id>`.

This is the most complex component. IntersectionObserver is hard to test directly in jsdom; the unit tests focus on rendering and click handler. Scroll-sync is integration-tested at the page level.

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/library/LibraryMasterDetail.spec.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import LibraryMasterDetail from './LibraryMasterDetail.svelte';
import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const library: EntuLibrary = { id: 'lib-1', name: 'EFK Library', orgId: 'org-1', editorIds: ['person-1'] };
const works: EntuWork[] = [
	{ id: 'work-a', libraryId: 'lib-1', composer: 'Duruflé', title: 'Requiem', voicing: 'SATB' },
	{ id: 'work-b', libraryId: 'lib-1', composer: 'Kreek', title: 'Taaveti', voicing: 'SATB' },
];
const editionsByWork = new Map<string, EntuEdition[]>([
	['work-a', [{ id: 'ed-1', workId: 'work-a', label: 'Peters', year: 1991 }]],
	['work-b', []],
]);

beforeEach(() => {
	// stub IntersectionObserver
	(globalThis as any).IntersectionObserver = class {
		observe = vi.fn();
		disconnect = vi.fn();
		unobserve = vi.fn();
	};
});

describe('LibraryMasterDetail', () => {
	it('renders the master and a paperstack per work', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		expect(container.querySelector('[data-work-id="work-a"]')).not.toBeNull();
		expect(container.querySelector('[data-work-id="work-b"]')).not.toBeNull();
	});

	it('selects the first work by default when no initialWorkId', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		const masterRowSel = container.querySelector('.master-paper [data-work-id="work-a"].sel');
		expect(masterRowSel).not.toBeNull();
	});

	it('selects the initialWorkId when provided', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-b' },
		});
		const masterRowSel = container.querySelector('.master-paper [data-work-id="work-b"].sel');
		expect(masterRowSel).not.toBeNull();
	});

	it('updates selection on master row click', async () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		const masterRowB = container.querySelector('.master-paper [data-work-id="work-b"]') as HTMLElement;
		await fireEvent.click(masterRowB);
		expect(container.querySelector('.master-paper [data-work-id="work-b"].sel')).not.toBeNull();
		expect(container.querySelector('.master-paper [data-work-id="work-a"].sel')).toBeNull();
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/lib/components/library/LibraryMasterDetail.spec.ts
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/library/LibraryMasterDetail.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';
	import LibraryMaster from './LibraryMaster.svelte';
	import LibraryWorkPaperStack from './LibraryWorkPaperStack.svelte';

	interface Props {
		library: EntuLibrary;
		works: EntuWork[];
		editionsByWork: Map<string, EntuEdition[]>;
		initialWorkId: string | null;
	}
	let { library, works, editionsByWork, initialWorkId }: Props = $props();

	let selectedWorkId = $state<string | null>(initialWorkId ?? works[0]?.id ?? null);
	let detailContainer: HTMLDivElement | undefined = $state();
	let observer: IntersectionObserver | undefined = $state();
	let userScrolling = $state(false);

	function handleSelect(workId: string) {
		selectedWorkId = workId;
		userScrolling = false;
		syncUrl(workId);
		const el = document.getElementById(`work-${workId}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function syncUrl(workId: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('work', workId);
		history.replaceState(history.state, '', url.toString());
	}

	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		observer = new IntersectionObserver(
			(entries) => {
				const inView = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				if (inView) {
					const workId = (inView.target as HTMLElement).getAttribute('data-work-id');
					if (workId && workId !== selectedWorkId) {
						selectedWorkId = workId;
						syncUrl(workId);
					}
				}
			},
			{ root: null, threshold: 0.5, rootMargin: '-30% 0px -30% 0px' },
		);
		const stacks = detailContainer?.querySelectorAll('[data-work-id]') ?? [];
		stacks.forEach((el) => observer!.observe(el));
		return () => observer?.disconnect();
	});
</script>

<div class="md-wrap">
	<LibraryMaster
		{works}
		{selectedWorkId}
		onselect={handleSelect}
	/>
	<div class="detail-col" bind:this={detailContainer}>
		{#each works as work (work.id)}
			<LibraryWorkPaperStack
				{work}
				editions={editionsByWork.get(work.id) ?? []}
				active={selectedWorkId === work.id}
			/>
		{/each}
	</div>
</div>

<style>
	.md-wrap {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 24px;
		align-items: flex-start;
	}
	.detail-col {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
</style>
```

- [ ] **Step 4: Verify PASS + gates**

```bash
pnpm test src/lib/components/library/LibraryMasterDetail.spec.ts
pnpm test && pnpm check && pnpm lint
```

Expected: 4 specs pass; total 495.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/library/LibraryMasterDetail.svelte src/lib/components/library/LibraryMasterDetail.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): LibraryMasterDetail — orchestrator with click-sync + IntersectionObserver"
git push
```

---

## Page integration

### Task 16: Update DeskSurface for background-attachment: fixed

**Files:**
- Modify: `src/lib/components/DeskSurface.svelte`

Verify the existing DeskSurface uses `background-attachment: fixed`. If not, add it.

- [ ] **Step 1: Read the current DeskSurface**

```bash
cat src/lib/components/DeskSurface.svelte
```

- [ ] **Step 2: If `background-attachment: fixed` is missing, add it**

In the `<style>` block, find the rule that sets `background:` on the surface element and add `background-attachment: fixed;` to the same rule. If it's already there, skip this task.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit (only if a change was needed)**

```bash
git add src/lib/components/DeskSurface.svelte
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "fix(#chore-67): DeskSurface uses background-attachment: fixed so desk doesn't slide"
git push
```

(If no change was needed, skip the commit and continue to Task 17.)

---

### Task 17: Global scrollbar-hiding in app.css

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Append the scrollbar-hiding rule**

Add to the bottom of `src/app.css`:

```css
/* CHORE-67 — hide scrollbars globally. Scrolling works via wheel/trackpad/keys. */
html,
body,
* {
	scrollbar-width: none;
	-ms-overflow-style: none;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar,
*::-webkit-scrollbar {
	display: none;
	width: 0;
	height: 0;
}
```

- [ ] **Step 2: Verify build still works**

```bash
pnpm build
pnpm test
```

Expected: build clean; tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app.css
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "style(#chore-67): hide scrollbars globally for the physical-desk feel"
git push
```

---

### Task 18: Wire /library/+page.svelte to the new components

**Files:**
- Modify: `src/routes/library/+page.svelte`
- Modify: `src/routes/library/page.spec.ts`

Replace the existing catalog-strip section with a section that consumes `$librarySectionStore`. On mount + on `$selectedOrgStore.id` change, fire `hydrateLibrarySection`. On `no-rights` / `no-library`, redirect to /. On `empty`, show LibraryEmptyState. On `ready`, mount LibraryMasterDetail.

- [ ] **Step 1: Tallis RED — update page.spec.ts to test the new section**

Read the current `src/routes/library/page.spec.ts` to understand existing assertions. Add a describe block that mocks `librarySectionStore` in each state and asserts the right thing renders:

```ts
// Append to src/routes/library/page.spec.ts
import { librarySectionStore } from '$lib/library/libraryStore';

describe('library page — section-state rendering', () => {
	it('shows the empty-state marginalia when status is empty', async () => {
		librarySectionStore.set({
			status: 'empty',
			library: { id: 'lib-1', name: 'EFK Library', orgId: 'org-1', editorIds: ['p-1'] },
		});
		const { container } = render(Page);
		expect(container.textContent).toContain("Nothing's catalogued yet");
	});

	it('renders the master-detail when status is ready', async () => {
		librarySectionStore.set({
			status: 'ready',
			library: { id: 'lib-1', name: 'EFK Library', orgId: 'org-1', editorIds: ['p-1'] },
			works: [{ id: 'w-1', libraryId: 'lib-1', composer: 'Test', title: 'Title' }],
			editionsByWork: new Map([['w-1', []]]),
		});
		const { container } = render(Page);
		expect(container.querySelector('[data-work-id="w-1"]')).not.toBeNull();
	});
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm test src/routes/library/page.spec.ts
```

- [ ] **Step 3: Byrd GREEN — modify `+page.svelte`**

Open `src/routes/library/+page.svelte`. The mock-import section reads:

```svelte
import { CHOIR, TODAY, MEMBERS, WORKS, TASKS } from '$lib/fixtures/library-mock';
import { libStats, workById, byMemberId } from '$lib/library/derive';
```

Keep those imports (the task stacks still use them). Add new imports:

```svelte
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { selectedOrgStore, userStore } from '$lib/auth/userStore';
import { librarySectionStore, hydrateLibrarySection } from '$lib/library/libraryStore';
import LibraryMasterDetail from '$lib/components/library/LibraryMasterDetail.svelte';
import LibraryEmptyState from '$lib/components/library/LibraryEmptyState.svelte';
```

Add the hydration effect (in the `<script>` block):

```ts
let initialWorkId = $derived(page.url.searchParams.get('work'));

$effect(() => {
	const org = $selectedOrgStore;
	const user = $userStore;
	if (!org || user.status !== 'ready') return;
	hydrateLibrarySection({ orgId: org.id, personId: user.personId });
});

$effect(() => {
	const state = $librarySectionStore;
	if (state.status === 'no-rights' || state.status === 'no-library') {
		goto('/');
	}
});
```

Replace the catalog-strip section near the bottom of the template (the one rendering `MiniWorkCard` cards) with:

```svelte
{#if $librarySectionStore.status === 'loading'}
	<div class="library-loading">…loading library…</div>
{:else if $librarySectionStore.status === 'empty'}
	<LibraryEmptyState />
{:else if $librarySectionStore.status === 'ready'}
	<LibraryMasterDetail
		library={$librarySectionStore.library}
		works={$librarySectionStore.works}
		editionsByWork={$librarySectionStore.editionsByWork}
		initialWorkId={initialWorkId}
	/>
{:else if $librarySectionStore.status === 'error'}
	<div class="library-error">Something went wrong loading the library.</div>
{/if}
```

(The `no-rights` / `no-library` branches don't render anything — the $effect above already navigated.)

- [ ] **Step 4: Verify PASS + gates**

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
```

Expected: all 497 tests pass; check + lint + build clean.

- [ ] **Step 5: Commit**

```bash
git add src/routes/library/+page.svelte src/routes/library/page.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "feat(#chore-67): /library page consumes librarySectionStore + redirects on no-rights"
git push
```

---

## Verify GH #71 fix

### Task 19: Add a regression test for #71

**Files:**
- Modify: `src/routes/library/page.spec.ts`

Assert the over-fetch URL pattern doesn't fire from /library after CHORE-67.

- [ ] **Step 1: Tallis adds the regression spec**

Append:

```ts
describe('library page — GH #71 over-fetch regression', () => {
	it('does NOT fire the unfiltered organization query', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ entities: [] }) }));
		vi.stubGlobal('fetch', fetchMock);
		librarySectionStore.set({ status: 'loading' });
		render(Page);
		// Allow effects to fire
		await new Promise((r) => setTimeout(r, 50));
		const urls = fetchMock.mock.calls.map((c) => (c[0] as string));
		const overFetch = urls.find(
			(u) =>
				u.includes('_type.string=organization') &&
				!u.includes('_owner.reference') &&
				u.includes('limit=50'),
		);
		expect(overFetch).toBeUndefined();
	});
});
```

- [ ] **Step 2: Verify PASS (the rewrite already removed it)**

```bash
pnpm test src/routes/library/page.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/library/page.spec.ts
export MVOX_EXPECTED_BRANCH=chore/library-real-data
git commit -m "test(#chore-67): regression guard against GH #71 over-fetch"
git push
```

---

## Branch finalization

### Task 20: Final smoke + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full quality gate**

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
```

Expected: all clean. Test count around 498 (up from 468 baseline + ~30 new).

- [ ] **Step 2: Manual smoke (PO authorization required for deploy probe)**

Team-lead requests PO authorization to start a local dev server and visually verify:

```bash
pnpm dev
# Open http://localhost:5173/library in a browser
# Sign in as PO; verify:
# - Master shows 28 work rows (EFK library), sorted composer-alpha
# - Detail shows 28 work paperstacks with their editions nested
# - Scrolling the page advances which work is "in view" (orange-tinted stack + master row highlight)
# - Clicking a master row smooth-scrolls the detail
# - URL ?work=<id> updates as you scroll
# - Switch org to EKBL or EMKL (umbrella, likely has no library or empty) - confirm empty-state OR redirect-to-/
# - No scrollbars visible anywhere; wheel/trackpad/keys still scroll
```

- [ ] **Step 3: Report state to team-lead for Bentham handoff**

Final commit list, test count, gate state, manual-smoke notes.

---

### Task 21: Bentham review

**Files:** none (review only)

Standard team Bentham review per common-prompt:

- [ ] **Step 1: Bentham runs `git log --oneline branch..main` first**

Per session-22 calibration. Flags any negative-deltas on recently-ratified files.

- [ ] **Step 2: Bentham reviews per-commit-GREEN**

Each commit on the branch is checked out and tested. Branch is GREEN at every step.

- [ ] **Step 3: Bentham reviews architecture + hot-RED triggers**

- Path C compliance: no `src/lib/server/` imports in client; no direct `https://entu.app` calls outside the BFF/userStore pattern
- No Co-authored-by trailers in commit bodies (L104)
- v4E schema mutations check: none in this CHORE — no Schema-Change trailer needed

- [ ] **Step 4: Verdict via SendMessage to team-lead**

RED / YELLOW / GREEN with rationale.

---

### Task 22: Josquin squash-merge

**Files:** main branch

- [ ] **Step 1: Bring chore branch up to date with main (Option 1 from Bentham's calibration)**

```bash
cd /home/michelek/workspace
git checkout chore/library-real-data
git fetch --all --prune
git pull --ff-only
git merge main --no-ff -m "merge main into chore branch before squash"
```

- [ ] **Step 2: Verify GREEN after inter-merge**

```bash
export MVOX_EXPECTED_BRANCH=chore/library-real-data
pnpm test && pnpm check && pnpm lint && pnpm build
git push
```

- [ ] **Step 3: Diff-shape pre-squash verification (L110)**

```bash
git fetch origin main
git log --oneline origin/main..HEAD
git diff origin/main..HEAD --stat
```

Confirm: no unintended negative deltas (especially on `teams/mvox-dev/memory/*.md`).

- [ ] **Step 4: Squash-merge to main**

```bash
git checkout main
git pull --ff-only
export MVOX_EXPECTED_BRANCH=main
git merge --squash chore/library-real-data
git commit -m "$(cat <<'EOF'
feat(#chore-67): wire /library to real Entu data via master-detail

Replaces the static catalog strip on /library with a master-detail unit:
sticky compact index on the left + scrollable column of work paperstacks
with nested edition subcards on the right. Real Entu data scoped to the
selected org's library entity, librarian-only (selecting a non-librarian
org redirects to /). IntersectionObserver-driven scroll-sync keeps the
master selection in sync with whichever work is currently in viewport
center. URL ?work=<id> for sharable selection. Wood-grain DeskSurface
dominates the canvas; all scrollbars hidden globally.

The 3 task stacks (Returns / Overdue / Pull) stay on mock data; those
need Copy/Lending entity types deferred to future CHOREs.

Contributors: Tallis (RED), Byrd (GREEN), Comenius (i18n),
Pérotin (edition-fetch strategy probe), Bentham (review).

Resolves GH #71 (over-fetch from /library is no longer emitted).
EOF
)"
```

- [ ] **Step 5: Push + delete branch**

```bash
git push origin main
git push origin --delete chore/library-real-data
git branch -D chore/library-real-data
```

- [ ] **Step 6: Team-lead manually closes GH #71 with a comment referencing the merge SHA**

```bash
gh issue close 71 --comment "Resolved by CHORE-67 squash $(git log -1 --format=%H main). The /library page no longer fires the unfiltered organization query; it now uses librarySectionStore which queries works under the selected org's library entity."
```

- [ ] **Step 7: Team-lead authorizes wrangler deploy to bring CHORE-67 live on mvox.eu**

Optional but typically follows merge. Dispatch Josquin per the session-23 pattern:

```bash
set -a; . ~/.config/mvox/credentials.env; set +a
pnpm install --frozen-lockfile
pnpm build
pnpm exec wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox --branch=main
# Verify build hash rotates on mvox.eu
```

---

## Self-review

**Spec coverage check:**
- ✅ Audience & gating (librarian-only, picker global, redirect-on-no-rights) — Task 6 (rights check), Task 18 (redirect)
- ✅ Page layout (wood-grain, sticky master, full-height detail, master fade) — Tasks 13, 15, 16, 17
- ✅ Wood-grain background-attachment fixed — Task 16
- ✅ All scrollbars hidden — Task 17
- ✅ Master-detail components (5 new) — Tasks 11, 12, 13, 14, 15
- ✅ Master fade right edge — Task 13 (LibraryMaster style block)
- ✅ Stacked-paper work cards — Task 12
- ✅ Edition subcards tinted — Task 11
- ✅ "In view" active state — Task 12 + Task 15 (IntersectionObserver)
- ✅ URL state ?work=<id> — Task 15
- ✅ Click-master smooth-scroll — Task 15
- ✅ Data flow (3 parallel-ish queries) — Tasks 6, 8, 9
- ✅ Discriminated-union state store — Task 10
- ✅ Empty-library marginalia — Task 14
- ✅ i18n keys — Task 3
- ✅ Types — Task 4
- ✅ GH #71 regression — Task 19
- ✅ Quality gates each task
- ✅ Bentham review + Josquin merge — Tasks 21, 22

**Placeholder scan:** No "TBD" / "TODO" / "implement later" / vague guidance. Pérotin's probe in Task 2 is a real probe with concrete commands; the spec-text update in Step 3 of Task 2 is concrete.

**Type consistency check:** `EntuLibrary`, `EntuWork`, `EntuEdition` defined in Task 4 and used identically thereafter. `LibrarySectionState` discriminated union defined in Task 10. Component props match in Tasks 11-15.

(*MVOX:Palestrina*)
