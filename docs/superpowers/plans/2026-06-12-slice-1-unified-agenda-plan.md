# MVP Slice 1 — Unified Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/agenda` — chronological upcoming-rehearsals list across all the user's orgs (spec: `docs/superpowers/specs/2026-06-12-slice-1-unified-agenda-design.md`).

**Architecture:** New aggregation module `src/lib/agenda/agendaData.ts` consumes existing `listSeasons` + `listRehearsals` (no new Entu wire code). New `AgendaList` component renders date-grouped rows. Route `src/routes/agenda/+page.svelte` follows the `/seasons` client-hydration pattern. Nav tab already exists — gets its href.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TS strict, Vitest, Paraglide i18n, Tailwind v4.

**Branch:** `feat/agenda` off main.

**TDD chain:** Comenius (i18n keys upfront) → Tallis (RED) → Josquin (GREEN data) → Byrd (GREEN UI) → Bentham (REVIEW) → Josquin (MERGE + deploy).

---

## File Map

| File | Action | Owner |
|---|---|---|
| `messages/{en,et,lv,uk}.json` | Add 5 `agenda_*` keys | Comenius |
| `src/lib/agenda/agendaData.ts` | Create (aggregation + types) | Josquin |
| `src/lib/agenda/agendaData.spec.ts` | Create | Tallis |
| `src/lib/components/agenda/AgendaList.svelte` | Create | Byrd |
| `src/lib/components/agenda/AgendaList.spec.ts` | Create | Tallis |
| `src/routes/agenda/+page.svelte` | Create | Byrd |
| `src/routes/agenda/page.spec.ts` | Create | Tallis |
| `src/lib/components/MvoxNav.svelte` | Wire agenda tab href + active state | Byrd |

---

### Task 1: i18n keys (Comenius)

**Files:** Modify: `messages/en.json`, `messages/et.json`, `messages/lv.json`, `messages/uk.json`

- [ ] **Step 1: Add the 5 keys to all 4 locale files**

English values (Comenius authors et/lv/uk per i18n-conventions):

```json
{
	"agenda_title": "Agenda",
	"agenda_empty_no_orgs": "You're not in any choir yet. Ask your choir admin for an invite.",
	"agenda_empty_no_rehearsals": "No upcoming rehearsals.",
	"agenda_partial_error": "Couldn't load rehearsals for: {orgs}",
	"agenda_duration_min": "{minutes} min"
}
```

Note `agenda_partial_error` and `agenda_duration_min` take parameters — use Paraglide's `{param}` syntax consistently with existing keys.

- [ ] **Step 2: Verify Paraglide compiles**

Run: `pnpm build 2>&1 | head -20` (Paraglide compile runs as part of build prep) or `pnpm check`.
Expected: no missing-key or syntax errors.

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "i18n(#10): agenda keys ×4 locales (5 keys)"
```

---

### Task 2: RED — data layer + component + route tests (Tallis)

**Files:**
- Create: `src/lib/agenda/agendaData.spec.ts`
- Create: `src/lib/components/agenda/AgendaList.spec.ts`
- Create: `src/routes/agenda/page.spec.ts`
- Create (stubs, per L120 — so RED fails on assertions not module resolution): `src/lib/agenda/agendaData.ts`, `src/lib/components/agenda/AgendaList.svelte`, `src/routes/agenda/+page.svelte`

- [ ] **Step 1: Create the stub module** `src/lib/agenda/agendaData.ts`:

```ts
import type { Org } from '$lib/auth/types';
import type { Rehearsal } from '$lib/seasons/types';
import type { EntuCfg } from '$lib/seasons/entuSeasons';

export interface AgendaItem extends Rehearsal {
	orgId: string;
	orgLabel: string;
}

export interface AgendaResult {
	items: AgendaItem[];
	errors: string[];
}

export async function listAgenda(_cfg: EntuCfg, _orgs: Org[], _now: Date): Promise<AgendaResult> {
	throw new Error('not implemented');
}
```

- [ ] **Step 2: Write `src/lib/agenda/agendaData.spec.ts`**

Mock `$lib/seasons/entuSeasons` with `vi.mock` — `listAgenda` consumes `listSeasons` + `listRehearsals`; the tests drive those mocks with realistic shapes (ISO datetimes, YYYY-MM-DD dates):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAgenda } from './agendaData';
import * as entuSeasons from '$lib/seasons/entuSeasons';

vi.mock('$lib/seasons/entuSeasons', () => ({
	listSeasons: vi.fn(),
	listRehearsals: vi.fn(),
}));

const cfg = { db: 'testdb', token: 'jwt' };
const NOW = new Date('2026-06-12T10:00:00.000Z');
const org = (id: string, label: string) => ({ id, label, initials: label.slice(0, 2) });

beforeEach(() => vi.clearAllMocks());

describe('listAgenda', () => {
	it('merges rehearsals across orgs, sorted chronologically, annotated with org', async () => {
		vi.mocked(entuSeasons.listSeasons).mockImplementation(async (_c, orgId) => [
			{ id: `season-${orgId}`, name: 'S', startDate: '2026-06-01', endDate: '2027-05-31' },
		]);
		vi.mocked(entuSeasons.listRehearsals).mockImplementation(async (_c, { orgId }) =>
			orgId === 'orgA'
				? [
						{ id: 'r2', seriesId: 's1', startDatetime: '2026-06-20T16:00:00.000Z', durationMinutes: 120, location: 'Hall A', name: 'Tue', description: undefined },
					]
				: [
						{ id: 'r1', seriesId: 's2', startDatetime: '2026-06-15T16:00:00.000Z', durationMinutes: 90, location: undefined, name: 'Mon', description: undefined },
					],
		);
		const res = await listAgenda(cfg, [org('orgA', 'EFK'), org('orgB', 'Koor B')], NOW);
		expect(res).toEqual({
			items: [
				{ id: 'r1', seriesId: 's2', startDatetime: '2026-06-15T16:00:00.000Z', durationMinutes: 90, location: undefined, name: 'Mon', description: undefined, orgId: 'orgB', orgLabel: 'Koor B' },
				{ id: 'r2', seriesId: 's1', startDatetime: '2026-06-20T16:00:00.000Z', durationMinutes: 120, location: 'Hall A', name: 'Tue', description: undefined, orgId: 'orgA', orgLabel: 'EFK' },
			],
			errors: [],
		});
	});

	it('skips seasons that ended before today', async () => {
		vi.mocked(entuSeasons.listSeasons).mockResolvedValue([
			{ id: 'old', name: 'Old', startDate: '2025-09-01', endDate: '2026-05-31' },
			{ id: 'cur', name: 'Cur', startDate: '2026-06-01', endDate: '2027-05-31' },
		]);
		vi.mocked(entuSeasons.listRehearsals).mockResolvedValue([]);
		await listAgenda(cfg, [org('o1', 'A')], NOW);
		expect(entuSeasons.listRehearsals).toHaveBeenCalledTimes(1);
		expect(entuSeasons.listRehearsals).toHaveBeenCalledWith(cfg, { orgId: 'o1', seasonId: 'cur' });
	});

	it('filters out rehearsals earlier than now (boundary: this morning excluded)', async () => {
		vi.mocked(entuSeasons.listSeasons).mockResolvedValue([
			{ id: 's', name: 'S', startDate: '2026-06-01', endDate: '2027-05-31' },
		]);
		vi.mocked(entuSeasons.listRehearsals).mockResolvedValue([
			{ id: 'past', seriesId: 'x', startDatetime: '2026-06-12T07:00:00.000Z', durationMinutes: 60, location: undefined, name: undefined, description: undefined },
			{ id: 'next', seriesId: 'x', startDatetime: '2026-06-12T16:00:00.000Z', durationMinutes: 60, location: undefined, name: undefined, description: undefined },
		]);
		const res = await listAgenda(cfg, [org('o1', 'A')], NOW);
		expect(res.items.map((i) => i.id)).toEqual(['next']);
	});

	it('a failing org contributes errors entry, other orgs still load', async () => {
		vi.mocked(entuSeasons.listSeasons).mockImplementation(async (_c, orgId) => {
			if (orgId === 'bad') throw new Error('403');
			return [{ id: 's', name: 'S', startDate: '2026-06-01', endDate: '2027-05-31' }];
		});
		vi.mocked(entuSeasons.listRehearsals).mockResolvedValue([
			{ id: 'r1', seriesId: 'x', startDatetime: '2026-07-01T16:00:00.000Z', durationMinutes: 60, location: undefined, name: undefined, description: undefined },
		]);
		const res = await listAgenda(cfg, [org('bad', 'Broken'), org('ok', 'Fine')], NOW);
		expect(res.errors).toEqual(['Broken']);
		expect(res.items.map((i) => i.orgId)).toEqual(['ok']);
	});

	it('returns empty result for zero orgs without fetching', async () => {
		const res = await listAgenda(cfg, [], NOW);
		expect(res).toEqual({ items: [], errors: [] });
		expect(entuSeasons.listSeasons).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 3: Stub `AgendaList.svelte` + `+page.svelte`** (minimal renderable placeholders so component tests fail on assertions). `AgendaList.svelte`:

```svelte
<script lang="ts">
	import type { AgendaItem } from '$lib/agenda/agendaData';
	interface Props {
		items: AgendaItem[];
		errors?: string[];
	}
	const { items, errors = [] }: Props = $props();
	void items;
	void errors;
</script>

<div data-testid="agenda-list"></div>
```

- [ ] **Step 4: Write `AgendaList.spec.ts`** — assert (with `@testing-library/svelte`, mirroring `RehearsalList.spec.ts` patterns):
  - date-group headers: items on the same calendar day (Europe/Tallinn) share one header; different days get separate headers, chronological
  - row content: time (HH:MM, Europe/Tallinn), duration via `agenda_duration_min`, rehearsal name, org label, location when present / absent when not
  - `data-testid="agenda-row-<id>"` per row; org label inside `data-testid="agenda-org-chip"`
  - empty: `items=[]` renders `agenda_empty_no_rehearsals` text
  - errors present: renders `agenda_partial_error` notice containing the org labels

- [ ] **Step 5: Write `page.spec.ts`** — mock `$lib/agenda/agendaData` + `$lib/auth/userStore`; assert: ready-user with orgs → `listAgenda` called with those orgs → list rendered; ready-user with zero orgs → `agenda_empty_no_orgs`; loading state shows skeleton (`data-testid="agenda-loading"`).

- [ ] **Step 6: Run + confirm RED**

Run: `pnpm vitest run src/lib/agenda src/lib/components/agenda src/routes/agenda 2>&1 | tail -20`
Expected: data-layer tests fail on `not implemented`; component/page tests fail on missing content. `pnpm check` passes (stubs resolve).

- [ ] **Step 7: Commit**

```bash
git add src/lib/agenda src/lib/components/agenda src/routes/agenda
git commit -m "test(#10): RED — agenda data layer + AgendaList + route (stubs per L120)"
```

---

### Task 3: GREEN data layer (Josquin)

**Files:** Modify: `src/lib/agenda/agendaData.ts`

- [ ] **Step 1: Implement `listAgenda`**

```ts
export async function listAgenda(cfg: EntuCfg, orgs: Org[], now: Date): Promise<AgendaResult> {
	if (orgs.length === 0) return { items: [], errors: [] };
	const today = now.toISOString().slice(0, 10);
	const nowIso = now.toISOString();
	const errors: string[] = [];

	const perOrg = await Promise.all(
		orgs.map(async (org): Promise<AgendaItem[]> => {
			try {
				const seasons = await listSeasons(cfg, org.id);
				const ongoing = seasons.filter((s) => s.endDate >= today);
				const lists = await Promise.all(
					ongoing.map((s) => listRehearsals(cfg, { orgId: org.id, seasonId: s.id })),
				);
				return lists.flat().map((r) => ({ ...r, orgId: org.id, orgLabel: org.label }));
			} catch {
				errors.push(org.label);
				return [];
			}
		}),
	);

	const items = perOrg
		.flat()
		.filter((r) => r.startDatetime >= nowIso)
		.sort((a, b) => a.startDatetime.localeCompare(b.startDatetime));
	return { items, errors };
}
```

(Replace the stub body; keep the exported interfaces. Import `listSeasons`, `listRehearsals` from `$lib/seasons/entuSeasons`.)

- [ ] **Step 2: Verify data tests GREEN**

Run: `pnpm vitest run src/lib/agenda 2>&1 | tail -10`
Expected: all `agendaData.spec.ts` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agenda/agendaData.ts
git commit -m "feat(#10): listAgenda aggregation — merge/filter/sort across orgs"
```

Then message Byrd: data layer ready.

---

### Task 4: GREEN UI (Byrd)

**Files:** Modify: `src/lib/components/agenda/AgendaList.svelte`, `src/routes/agenda/+page.svelte`, `src/lib/components/MvoxNav.svelte`

- [ ] **Step 1: Implement `AgendaList.svelte`** — date-grouped rows. Grouping key: `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' })` on `startDatetime`; header text via locale-aware `Intl.DateTimeFormat(undefined, { timeZone: 'Europe/Tallinn', weekday: 'long', day: 'numeric', month: 'long' })`. Rows: time `HH:MM` (Europe/Tallinn), `m.agenda_duration_min({ minutes })`, name, org chip, location. Paper-card aesthetic per existing `RehearsalList` (Inter, ink colors, `sk-box`-style cards). Test-ids per RED spec.

- [ ] **Step 2: Implement `+page.svelte`** — mirror `/seasons/+page.svelte` hydration shell: subscribe `userStore`; on `ready` call `listAgenda(cfg, orgs, new Date())` (cfg from `PUBLIC_ENTU_DB` + storage JWT, existing helper pattern); render loading skeleton / `AgendaList` / `agenda_empty_no_orgs`. Title `m.agenda_title()`.

- [ ] **Step 3: Wire the nav tab** — in `MvoxNav.svelte`, give the `agenda` tab `href="/agenda"` + active state exactly as the `seasons` tab does (copy that wiring).

- [ ] **Step 4: Full verify**

Run: `pnpm vitest run 2>&1 | tail -5 && pnpm check`
Expected: entire suite green, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/agenda src/routes/agenda src/lib/components/MvoxNav.svelte
git commit -m "feat(#10): /agenda — date-grouped unified rehearsal list + nav tab wiring"
```

---

### Task 5: REVIEW (Bentham)

- [ ] Review `git diff main..feat/agenda`. Checklist: TDD order (RED commit precedes GREEN); stubs-in-RED per L120; runes-only Svelte 5; no server imports in client; no direct entu.app calls outside the data layer; full-shape assertions (no objectContaining on new tests); responsive classes carry base `hidden` where applicable (L118); i18n — no hardcoded strings, keys in all 4 locales; agenda read path adds no new rights surface. Verdict → team-lead.

---

### Task 6: MERGE + deploy (Josquin)

**Precondition:** Bentham GREEN/YELLOW-addressed + team-lead approval.

- [ ] Squash-merge per common-prompt procedure; commit message `feat(#10): unified singer agenda — /agenda` + `Closes #10`.
- [ ] Verify on main: `pnpm vitest run 2>&1 | tail -5 && pnpm check`
- [ ] `git push`; delete branch local+remote.
- [ ] Build + deploy preview: `pnpm build && set -a; . ~/.config/mvox/credentials.env; set +a; wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox --branch=preview-seasons` (CF transient 8000000 → retry ≤3×).
- [ ] Report build hash to team-lead → team-lead pings PO.

---

(*MVOX:Palestrina*)
