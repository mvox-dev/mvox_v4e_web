# /library page + UI kit implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the librarian-view `/library` page + redesign `/auth/login` and `/auth/logout` per the design system, using a reusable 21-component UI kit synthesized from the 2026-05-23 Claude Design bundle.

**Architecture:** Svelte 5 (Runes) + Tailwind v4 (@theme) + SvelteKit nested layouts. Each component is `src/lib/components/<Name>.svelte` with a colocated `<Name>.spec.ts` (Vitest + happy-dom + `@testing-library/svelte`). Page reads from `src/lib/fixtures/library-mock.ts` (typed TS const exports matching the bundle's mock data); live Entu wiring is a follow-up CHORE. Auth pages preserve all CHORE-B logic (storage, OAuth flow, callback, redirect timers) and replace only the visual layer.

**Tech Stack:** SvelteKit 2 + Svelte 5 Runes (no legacy `export let`/`$:`), Tailwind v4, Vitest + happy-dom, `@testing-library/svelte` v5 (to be added), Paraglide for i18n (en/et/lv/uk), pnpm.

**Spec:** `docs/superpowers/specs/2026-05-23-library-page-ui-kit-design.md` (PO-approved, on main at `bcb4795`)

**Branch:** `feat/library-page-ui-kit` from main.

---

## File structure

### Created
- `src/lib/types/library.ts` — entity types (Work, Edition, Copy, Loan, Member, Choir, Task)
- `src/lib/fixtures/library-mock.ts` — bundle's mock data ported to typed TS
- `src/lib/library/derive.ts` — pure helpers (libStats, workStats, byMemberId, etc.)
- `src/lib/library/derive.spec.ts` — derive helper tests
- `src/lib/components/Voice.svelte` + `Voice.spec.ts`
- `src/lib/components/PencilCheckbox.svelte` + `PencilCheckbox.spec.ts`
- `src/lib/components/Rank.svelte` + `Rank.spec.ts`
- `src/lib/components/Stamp.svelte` + `Stamp.spec.ts`
- `src/lib/components/Tally.svelte` + `Tally.spec.ts`
- `src/lib/components/WorkTitle.svelte` + `WorkTitle.spec.ts`
- `src/lib/components/Margin.svelte` + `Margin.spec.ts`
- `src/lib/components/KeyHint.svelte` + `KeyHint.spec.ts`
- `src/lib/components/BrandMark.svelte` + `BrandMark.spec.ts`
- `src/lib/components/VoiceTally.svelte` + `VoiceTally.spec.ts`
- `src/lib/components/CopyChip.svelte` + `CopyChip.spec.ts`
- `src/lib/components/PencilSearch.svelte` + `PencilSearch.spec.ts`
- `src/lib/components/PaperStack.svelte` + `PaperStack.spec.ts`
- `src/lib/components/StackHeader.svelte` + `StackHeader.spec.ts`
- `src/lib/components/PaperCard.svelte` + `PaperCard.spec.ts`
- `src/lib/components/BorrowerCard.svelte` + `BorrowerCard.spec.ts`
- `src/lib/components/PullItemCard.svelte` + `PullItemCard.spec.ts`
- `src/lib/components/MiniWorkCard.svelte` + `MiniWorkCard.spec.ts`
- `src/lib/components/DeskSurface.svelte` + `DeskSurface.spec.ts`
- `src/lib/components/MvoxNav.svelte` + `MvoxNav.spec.ts`
- `src/lib/components/ProviderButton.svelte` + `ProviderButton.spec.ts`
- `src/routes/library/+page.svelte` — composed library page
- `src/routes/library/+layout.svelte` — nested layout (escapes max-w-5xl)
- `src/routes/library/page.spec.ts` — page smoke test

### Modified
- `src/app.css` — add Tailwind v4 `@theme` token block + font @import
- `src/routes/+layout.svelte` — restructure to support child opt-out (page wrapper moves into child layout)
- `src/routes/auth/login/+page.svelte` — visual redesign, preserve all CHORE-B logic
- `src/routes/auth/logout/+page.svelte` — visual redesign, add 5s auto-redirect with Esc-to-cancel
- `messages/en.json` — add new keys for librarian view + auth screens
- `messages/et.json` — same keys (Estonian)
- `messages/lv.json` — same keys (Latvian)
- `messages/uk.json` — same keys (Ukrainian)
- `package.json` — add `@testing-library/svelte@^5` dev dep
- `vitest.config.ts` (or `vite.config.ts`) — ensure happy-dom default; verify (already configured per existing logout/page.spec.ts which uses `// @vitest-environment happy-dom`)

---

### Task 1: Branch + test infrastructure setup

**Files:**
- Modify: `package.json` (add dev dep)
- No test in this task (infrastructure setup)

- [ ] **Step 1: Create the feature branch from current main**

Run: `git checkout main && git pull && git checkout -b feat/library-page-ui-kit`
Expected: switched to a new branch 'feat/library-page-ui-kit'

- [ ] **Step 2: Add `@testing-library/svelte` v5 dev dep**

Run: `pnpm add -D @testing-library/svelte@^5`
Expected: package installs without errors; `package.json` updated.

- [ ] **Step 3: Sanity-check existing test infrastructure**

Run: `pnpm test:unit` (existing tests, no new ones yet)
Expected: PASS — all existing vitest tests still pass after adding the dep.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @testing-library/svelte for component tests"
```

- [ ] **Step 5: Run full verification gate**

Run: `pnpm check && pnpm test:unit && pnpm lint && pnpm build`
Expected: 0 type errors, all unit tests pass, 0 lint errors, build clean.

---

### Task 2: Tokens + fonts in app.css

**Files:**
- Modify: `src/app.css`
- Test: `src/tests/tokens.spec.ts` (create) — verifies presence of tokens by scanning the file

- [ ] **Step 1: Write the failing test**

Create `src/tests/tokens.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_CSS = readFileSync(resolve(__dirname, '../app.css'), 'utf-8');

describe('app.css design tokens', () => {
  it('imports Tailwind', () => {
    expect(APP_CSS).toMatch(/@import\s+["']tailwindcss["']/);
  });

  it('imports Caveat, Inter, JetBrains Mono fonts', () => {
    expect(APP_CSS).toMatch(/fonts\.googleapis\.com.*Caveat/);
    expect(APP_CSS).toMatch(/Inter/);
    expect(APP_CSS).toMatch(/JetBrains\+Mono/);
  });

  it('declares paper/ink color tokens in @theme', () => {
    expect(APP_CSS).toMatch(/@theme/);
    expect(APP_CSS).toMatch(/--color-paper:\s*#f7f1e1/);
    expect(APP_CSS).toMatch(/--color-ink:\s*#2a2620/);
    expect(APP_CSS).toMatch(/--color-red:\s*#b54a3a/);
    expect(APP_CSS).toMatch(/--color-green:\s*#5f7a3b/);
    expect(APP_CSS).toMatch(/--color-indigo:\s*#4f46e5/);
    expect(APP_CSS).toMatch(/--color-highlight:\s*#f7e58a/);
  });

  it('declares voice color tokens', () => {
    expect(APP_CSS).toMatch(/--color-voice-s:/);
    expect(APP_CSS).toMatch(/--color-voice-a:/);
    expect(APP_CSS).toMatch(/--color-voice-t:/);
    expect(APP_CSS).toMatch(/--color-voice-b:/);
  });

  it('declares desk wood-grain colors', () => {
    expect(APP_CSS).toMatch(/--color-desk-1:/);
    expect(APP_CSS).toMatch(/--color-desk-base:/);
  });

  it('declares display font (Caveat)', () => {
    expect(APP_CSS).toMatch(/--font-display:.*Caveat/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/tests/tokens.spec.ts`
Expected: FAIL on most assertions — current app.css is just `@import "tailwindcss";`

- [ ] **Step 3: Update src/app.css with tokens + fonts**

Replace the entire contents of `src/app.css` with:

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@theme {
  --color-paper: #f7f1e1;
  --color-paper-2: #efe7d2;
  --color-paper-3: #e5dcc4;
  --color-ink: #2a2620;
  --color-ink-2: #4b443a;
  --color-ink-3: #7a7166;
  --color-ink-4: #a89f91;
  --color-ink-5: #c9bfa9;

  --color-red: #b54a3a;
  --color-red-soft: #f0d8d0;
  --color-green: #5f7a3b;
  --color-green-soft: #dde9cb;
  --color-amber: #b67a1e;
  --color-amber-soft: #f5e3bf;
  --color-indigo: #4f46e5;
  --color-indigo-soft: #e0e7ff;
  --color-highlight: #f7e58a;

  --color-voice-s: #fbe3c1;
  --color-voice-a: #fadcc4;
  --color-voice-t: #d6e9c2;
  --color-voice-b: #cdd9ee;

  --color-desk-1: #d6c39a;
  --color-desk-2: #d8c79e;
  --color-desk-3: #d4be94;
  --color-desk-base: #d3bf95;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-display: 'Caveat', cursive;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/tests/tokens.spec.ts && pnpm check && pnpm build`
Expected: PASS on tokens spec; 0 type errors; build clean (font @import survives CSS bundling).

- [ ] **Step 5: Commit**

```bash
git add src/app.css src/tests/tokens.spec.ts
git commit -m "feat(library): add design tokens + Caveat/Inter/Mono fonts"
```

---

### Task 3: Library types

**Files:**
- Create: `src/lib/types/library.ts`
- Test: `src/lib/types/library.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/library.spec.ts`:

```typescript
import { describe, expect, it, expectTypeOf } from 'vitest';
import type { Work, Edition, Copy, Loan, Member, Choir, Task, Voice } from './library';

describe('library types', () => {
  it('Voice is a literal-union of valid voice parts', () => {
    expectTypeOf<Voice>().toEqualTypeOf<'S1' | 'S2' | 'A' | 'T1' | 'T2' | 'B1' | 'B2'>();
  });

  it('Member has id, name, voice', () => {
    const m: Member = { id: 'x', name: 'Test Member', voice: 'S1' };
    expect(m.id).toBe('x');
  });

  it('Edition has total/on_loan/overdue numerics + optional limitless', () => {
    const e: Edition = {
      id: 'e1', label: 'L', voicing: 'SATB', publisher: 'P', year: 2020,
      total: 12, on_loan: 0, overdue: 0, returned_today: 0,
    };
    expect(e.total).toBe(12);
    const limitless: Edition = { ...e, total: 0, limitless: true };
    expect(limitless.limitless).toBe(true);
  });

  it('Work has nested editions', () => {
    const w: Work = {
      id: 'w1', composer: 'C', title: 'T', year: 2020, lang: 'Latin',
      period: 'Contemporary', tags: [], editions: [],
    };
    expect(w.editions).toEqual([]);
  });

  it('Loan has copy/member/since/days_overdue', () => {
    const l: Loan = { copy: '#1', member: 'x', since: '2025-01-01', days_overdue: 30 };
    expect(l.days_overdue).toBe(30);
  });

  it('Task has rank, kind, title, summary', () => {
    const t: Task = { id: 'x', rank: 1, kind: 'returns', title: 'T', summary: 'S' };
    expect(t.kind).toBe('returns');
  });

  it('Choir has slug, initials, rehearsal_size', () => {
    const c: Choir = { name: 'N', short: 'S', slug: 's', initials: 'SS', rehearsal_size: 48 };
    expect(c.rehearsal_size).toBe(48);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/types/library.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Create `src/lib/types/library.ts`**

```typescript
export type Voice = 'S1' | 'S2' | 'A' | 'T1' | 'T2' | 'B1' | 'B2';

export interface Choir {
  name: string;
  short: string;
  slug: string;
  initials: string;
  rehearsal_size: number;
}

export interface Member {
  id: string;
  name: string;
  voice: Voice;
}

export interface Loan {
  copy: string;
  member: string;
  since: string;
  days_overdue: number;
}

export interface Edition {
  id: string;
  label: string;
  voicing: string;
  publisher: string;
  year: number;
  isbn?: string;
  location?: string;
  total: number;
  on_loan: number;
  overdue: number;
  returned_today: number;
  limitless?: boolean;
  loans?: Loan[];
}

export interface Work {
  id: string;
  composer: string;
  title: string;
  title_alt?: string;
  year: number;
  lang: string;
  period: string;
  tags: string[];
  notes?: string;
  editions: Edition[];
}

export type TaskKind = 'returns' | 'overdue' | 'pull';

export interface Task {
  id: string;
  rank: number;
  kind: TaskKind;
  title: string;
  summary: string;
  work_id?: string;
  edition_id?: string;
  work_ids?: string[];
  count?: number;
  confirmed?: number;
  pending?: number;
  borrowers?: string[];
  days?: number;
  pulled?: Record<string, number>;
}

export interface Today {
  iso: string;
  dow: string;
  date: string;
  time: string;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/types/library.spec.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/library.ts src/lib/types/library.spec.ts
git commit -m "feat(library): add library entity types"
```

---

### Task 4: Mock fixtures + derive helpers

**Files:**
- Create: `src/lib/fixtures/library-mock.ts`
- Create: `src/lib/library/derive.ts`
- Test: `src/lib/library/derive.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/library/derive.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { CHOIR, MEMBERS, WORKS } from '../fixtures/library-mock';
import { libStats, workStats, byMemberId, workById, editionById } from './derive';

describe('library derive helpers', () => {
  it('libStats sums totals across all works', () => {
    const s = libStats(WORKS);
    expect(s.works).toBe(13);
    expect(s.copies).toBeGreaterThan(500);
    expect(s.on_loan).toBeGreaterThanOrEqual(4);
    expect(s.overdue).toBe(4);
  });

  it('workStats excludes limitless editions from total', () => {
    const part = WORKS.find(w => w.id === 'part-magnificat')!;
    const s = workStats(part);
    expect(s.total).toBe(54);
    expect(s.overdue).toBe(4);
    expect(s.has_limitless).toBe(true);
  });

  it('byMemberId returns the member for a known id', () => {
    const m = byMemberId(MEMBERS, 'hk');
    expect(m?.name).toBe('Henn Kuusik');
    expect(m?.voice).toBe('B2');
  });

  it('byMemberId returns undefined for unknown id', () => {
    expect(byMemberId(MEMBERS, 'xx')).toBeUndefined();
  });

  it('workById + editionById round-trip', () => {
    const w = workById(WORKS, 'tallis-spem');
    expect(w?.composer).toBe('Thomas Tallis');
    const e = editionById(w, 'tallis-40');
    expect(e?.publisher).toBe('Chester Novello');
  });

  it('CHOIR matches expected slug + rehearsal size', () => {
    expect(CHOIR.slug).toBe('epcc');
    expect(CHOIR.rehearsal_size).toBe(48);
  });

  it('MEMBERS has 8 entries with valid voices', () => {
    expect(MEMBERS.length).toBe(8);
    expect(MEMBERS.every(m => m.voice.length <= 2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/library/derive.spec.ts`
Expected: FAIL — fixtures + derive don't exist.

- [ ] **Step 3: Create `src/lib/fixtures/library-mock.ts`**

```typescript
import type { Choir, Member, Work, Task, Today } from '../types/library';

export const TODAY: Today = { iso: '2026-05-26', dow: 'Tue', date: '26 May 2026', time: '14:32' };

export const CHOIR: Choir = {
  name: 'Estonian Philharmonic Chamber Choir',
  short: 'EPCC',
  slug: 'epcc',
  initials: 'EP',
  rehearsal_size: 48,
};

export const MEMBERS: Member[] = [
  { id: 'mt', name: 'Maris Tamm',    voice: 'S1' },
  { id: 'ls', name: 'Liina Saar',    voice: 'S2' },
  { id: 'al', name: 'Ave Lepp',      voice: 'A'  },
  { id: 'kp', name: 'Kärt Põld',     voice: 'A'  },
  { id: 'tm', name: 'Toomas Mägi',   voice: 'T1' },
  { id: 'av', name: 'Andres Vahar',  voice: 'T2' },
  { id: 'mr', name: 'Margus Roos',   voice: 'B1' },
  { id: 'hk', name: 'Henn Kuusik',   voice: 'B2' },
];

export const WORKS: Work[] = [
  {
    id: 'tallis-spem', composer: 'Thomas Tallis', title: 'Spem in alium', year: 1570,
    lang: 'Latin', period: 'Renaissance', tags: ['sacred', 'motet', '40-voice'],
    notes: 'Returned this morning from December concert. Twelve copies counted.',
    editions: [
      { id: 'tallis-40', label: '40-part original', voicing: 'SSSSAAAATTTTBBBB ×5', publisher: 'Chester Novello', year: 1928, total: 12, on_loan: 0, overdue: 0, returned_today: 12 },
      { id: 'tallis-8',  label: '8-part reduction (Cooke)', voicing: 'SSAATTBB', publisher: 'OUP', year: 1989, total: 6, on_loan: 0, overdue: 0, returned_today: 0 },
    ],
  },
  {
    id: 'part-magnificat', composer: 'Arvo Pärt', title: 'Magnificat', year: 1989,
    lang: 'Latin', period: 'Contemporary', tags: ['sacred', 'Estonian', 'tintinnabuli'],
    notes: 'Four copies still out with two basses since November.',
    editions: [
      { id: 'mag-ue', label: 'Universal Edition · original', voicing: 'SSSAATBB', publisher: 'Universal Edition', year: 1989, isbn: 'UE-19400',
        total: 30, on_loan: 4, overdue: 4, returned_today: 0,
        loans: [
          { copy: '#14', member: 'hk', since: '2025-11-12', days_overdue: 195 },
          { copy: '#15', member: 'hk', since: '2025-11-12', days_overdue: 195 },
          { copy: '#22', member: 'mr', since: '2025-11-12', days_overdue: 195 },
          { copy: '#23', member: 'mr', since: '2025-11-12', days_overdue: 195 },
        ],
      },
      { id: 'mag-rh',  label: 'Hyperion · reduced (Layton ed.)', voicing: 'SATB div.', publisher: 'Hyperion Eds.', year: 2001, total: 24, on_loan: 0, overdue: 0, returned_today: 0 },
      { id: 'mag-org', label: 'UE · with organ', voicing: 'SATB + org.', publisher: 'Universal Edition', year: 1996, total: 0, on_loan: 0, overdue: 0, returned_today: 0, limitless: true },
    ],
  },
  {
    id: 'tormis-raua', composer: 'Veljo Tormis', title: 'Raua needmine', title_alt: 'Curse upon Iron', year: 1972,
    lang: 'Estonian', period: 'Contemporary', tags: ['Estonian', 'runo', 'shaman drum'],
    notes: 'Conductor wants to try tonight. 48 singers expected.',
    editions: [
      { id: 'raua-fg', label: 'Fennica Gehrman · SATB + shaman drum', voicing: 'SATB · drum', publisher: 'Fennica Gehrman', year: 1991, isbn: 'FG-552', total: 52, on_loan: 0, overdue: 0, returned_today: 0, location: 'Cabinet B · shelf 1' },
      { id: 'raua-pl', label: 'Pelle Pyy · a cappella reduction', voicing: 'SATB', publisher: 'Pyy', year: 2003, total: 18, on_loan: 0, overdue: 0, returned_today: 0 },
    ],
  },
  {
    id: 'kreek-onnis', composer: 'Cyrillus Kreek', title: 'Õnnis on inimene', title_alt: 'Blessed is the man', year: 1923,
    lang: 'Estonian', period: '20th century', tags: ['Estonian', 'sacred', 'psalm'],
    notes: 'For tonight. Owned in one edition — count is tight.',
    editions: [
      { id: 'onnis-sp', label: 'SP Muusikaprojekt', voicing: 'SATB', publisher: 'SP Muusikaprojekt', year: 1998, total: 42, on_loan: 2, overdue: 0, returned_today: 0, location: 'Cabinet A · shelf 4' },
    ],
  },
  {
    id: 'esenvalds-stars', composer: 'Ēriks Ešenvalds', title: 'Stars', year: 2011,
    lang: 'English', period: 'Contemporary', tags: ['Latvian', 'contemporary', 'tuned glasses'],
    notes: 'For tonight. Needs tuned water-glasses.',
    editions: [
      { id: 'stars-mt', label: 'Musica Baltica · SATB + glasses', voicing: 'SSAATTBB', publisher: 'Musica Baltica', year: 2011, isbn: 'MB-2089', total: 50, on_loan: 0, overdue: 0, returned_today: 0, location: 'Cabinet C · shelf 2' },
    ],
  },
  { id: 'part-beatitudes',  composer: 'Arvo Pärt',          title: 'The Beatitudes',       year: 1990, lang: 'English', period: 'Contemporary', tags: ['sacred', 'Estonian', 'tintinnabuli'], editions: [{ id: 'beat-ue', label: 'Universal Edition', voicing: 'SATB + org.', publisher: 'Universal Edition', year: 1990, total: 32, on_loan: 0, overdue: 0, returned_today: 0 }] },
  { id: 'esenvalds-sleep',  composer: 'Ēriks Ešenvalds',    title: 'Only in Sleep',        year: 2010, lang: 'English', period: 'Contemporary', tags: ['Latvian', 'soprano solo'],            editions: [{ id: 'sleep-mb', label: 'Musica Baltica', voicing: 'SSAATTBB + sop. solo', publisher: 'Musica Baltica', year: 2010, total: 48, on_loan: 0, overdue: 0, returned_today: 0 }] },
  { id: 'byrd-ave',         composer: 'William Byrd',       title: 'Ave verum corpus',     year: 1605, lang: 'Latin',   period: 'Renaissance',  tags: ['sacred', 'English'],                  editions: [{ id: 'ave-st', label: 'Stainer & Bell', voicing: 'SATB', publisher: 'Stainer & Bell', year: 1923, total: 60, on_loan: 0, overdue: 0, returned_today: 0 }] },
  { id: 'byrd-mass5',       composer: 'William Byrd',       title: 'Mass for Five Voices', year: 1595, lang: 'Latin',   period: 'Renaissance',  tags: ['sacred', 'English', 'mass'],          editions: [{ id: 'mass5-cs', label: 'Chester · ed. Fellowes', voicing: 'SSATB', publisher: 'Chester', year: 1922, total: 24, on_loan: 0, overdue: 0, returned_today: 0 }] },
  { id: 'hildegard-pastor', composer: 'Hildegard von Bingen', title: 'O Pastor Animarum', year: 1150, lang: 'Latin',   period: 'Medieval',     tags: ['sacred', 'plainchant'],                editions: [{ id: 'pastor-am', label: 'A-R Editions · transcription', voicing: 'Unison + drone', publisher: 'A-R Editions', year: 1998, total: 0, on_loan: 0, overdue: 0, returned_today: 0, limitless: true }] },
  { id: 'whitacre-sleep',   composer: 'Eric Whitacre',      title: 'Sleep',                year: 2000, lang: 'English', period: 'Contemporary', tags: ['American'],                           editions: [{ id: 'wh-sleep', label: 'Walton Music', voicing: 'SATB div.', publisher: 'Walton Music', year: 2000, total: 56, on_loan: 6, overdue: 0, returned_today: 0 }] },
  { id: 'nystedt-immortal', composer: 'Knut Nystedt',      title: 'Immortal Bach',         year: 1988, lang: 'German',  period: 'Contemporary', tags: ['Norwegian'],                          editions: [{ id: 'im-no', label: 'Norsk Musikforlag', voicing: 'SATB div.', publisher: 'Norsk Musikforlag', year: 1988, total: 50, on_loan: 0, overdue: 0, returned_today: 0 }] },
  { id: 'lauridsen-om',     composer: 'Morten Lauridsen',  title: 'O Magnum Mysterium',    year: 1994, lang: 'Latin',   period: 'Contemporary', tags: ['sacred', 'American'],                  editions: [{ id: 'om-pe', label: 'Peer Music', voicing: 'SATB', publisher: 'Peer Music', year: 1994, total: 48, on_loan: 0, overdue: 0, returned_today: 0 }] },
];

export const TASKS: Task[] = [
  { id: 'returns', rank: 1, kind: 'returns', title: 'Mark Tallis copies returned',
    summary: '12 copies of Spem in alium back from December concert',
    work_id: 'tallis-spem', edition_id: 'tallis-40', count: 12, confirmed: 8, pending: 4 },
  { id: 'overdue', rank: 2, kind: 'overdue', title: 'Chase Pärt Magnificat',
    summary: '4 copies still out with two basses since November',
    work_id: 'part-magnificat', edition_id: 'mag-ue', count: 4, borrowers: ['hk', 'mr'], days: 195 },
  { id: 'pull', rank: 3, kind: 'pull', title: "Pull tonight's three pieces",
    summary: 'Tormis · Kreek · Ešenvalds — 48 singers',
    work_ids: ['tormis-raua', 'kreek-onnis', 'esenvalds-stars'],
    pulled: { 'tormis-raua': 48, 'kreek-onnis': 0, 'esenvalds-stars': 0 } },
];
```

- [ ] **Step 4: Create `src/lib/library/derive.ts`**

```typescript
import type { Work, Member } from '../types/library';

export interface LibStats {
  works: number;
  editions: number;
  copies: number;
  on_loan: number;
  overdue: number;
  available: number;
}

export interface WorkStats {
  total: number;
  loaned: number;
  overdue: number;
  returned_today: number;
  available: number;
  has_limitless: boolean;
}

export function libStats(works: Work[]): LibStats {
  let editions = 0, copies = 0, on_loan = 0, overdue = 0;
  for (const w of works) {
    editions += w.editions.length;
    for (const e of w.editions) {
      copies += e.total || 0;
      on_loan += e.on_loan || 0;
      overdue += e.overdue || 0;
    }
  }
  return { works: works.length, editions, copies, on_loan, overdue, available: copies - on_loan };
}

export function workStats(w: Work): WorkStats {
  let total = 0, loaned = 0, overdue = 0, returned_today = 0, has_limitless = false;
  for (const e of w.editions) {
    if (e.limitless) { has_limitless = true; continue; }
    total += e.total || 0;
    loaned += e.on_loan || 0;
    overdue += e.overdue || 0;
    returned_today += e.returned_today || 0;
  }
  return { total, loaned, overdue, returned_today, available: total - loaned, has_limitless };
}

export function byMemberId(members: Member[], id: string): Member | undefined {
  return members.find(m => m.id === id);
}

export function workById(works: Work[], id: string): Work | undefined {
  return works.find(w => w.id === id);
}

export function editionById(work: Work | undefined, eid: string) {
  return work?.editions.find(e => e.id === eid);
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `pnpm vitest run src/lib/library/derive.spec.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fixtures/library-mock.ts src/lib/library/derive.ts src/lib/library/derive.spec.ts
git commit -m "feat(library): mock fixtures + derive helpers from bundle Data.jsx"
```

---

## Component test pattern (used by every primitive task below)

Every component spec follows this shape (using `@testing-library/svelte` with Svelte 5):

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Component from './Component.svelte';

describe('Component', () => {
  it('renders with required props', () => {
    const { container } = render(Component, { props: { /* props */ } });
    expect(container.textContent).toContain('...');
  });
});
```

---

### Task 5: Voice component

**Files:**
- Create: `src/lib/components/Voice.svelte`
- Test: `src/lib/components/Voice.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Voice from './Voice.svelte';

describe('Voice', () => {
  it('renders the voice label', () => {
    const { container } = render(Voice, { props: { v: 'S1' } });
    expect(container.textContent).toContain('S1');
  });

  it('applies voice-family class based on first character', () => {
    const { container } = render(Voice, { props: { v: 'B2' } });
    const el = container.querySelector('span');
    expect(el?.className).toMatch(/bg-voice-b/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/Voice.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create Voice.svelte**

```svelte
<script lang="ts">
  import type { Voice } from '$lib/types/library';
  const { v }: { v: Voice } = $props();
  const family = v[0] as 'S' | 'A' | 'T' | 'B';
  const bg = {
    S: 'bg-voice-s',
    A: 'bg-voice-a',
    T: 'bg-voice-t',
    B: 'bg-voice-b',
  }[family];
</script>

<span
  class="inline-flex items-center justify-center min-w-[26px] px-1.5 h-[19px] border border-[1.25px] border-ink-2 rounded font-mono text-[10px] font-semibold text-ink {bg}"
>{v}</span>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/Voice.spec.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Voice.svelte src/lib/components/Voice.spec.ts
git commit -m "feat(library): Voice badge component"
```

---

### Task 6: PencilCheckbox component

**Files:**
- Create: `src/lib/components/PencilCheckbox.svelte`
- Test: `src/lib/components/PencilCheckbox.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PencilCheckbox from './PencilCheckbox.svelte';

describe('PencilCheckbox', () => {
  it('renders unchecked by default', () => {
    const { container } = render(PencilCheckbox, { props: {} });
    const el = container.querySelector('span');
    expect(el?.getAttribute('data-checked')).toBe('false');
  });

  it('renders checked when prop is true', () => {
    const { container } = render(PencilCheckbox, { props: { checked: true } });
    const el = container.querySelector('span');
    expect(el?.getAttribute('data-checked')).toBe('true');
  });

  it('fires onclick when clicked', async () => {
    const onclick = vi.fn();
    const { container } = render(PencilCheckbox, { props: { onclick } });
    const el = container.querySelector('span')!;
    await fireEvent.click(el);
    expect(onclick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/PencilCheckbox.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create PencilCheckbox.svelte**

```svelte
<script lang="ts">
  const {
    checked = false,
    red = false,
    onclick,
  }: { checked?: boolean; red?: boolean; onclick?: () => void } = $props();
</script>

<span
  data-checked={checked}
  class="inline-block align-middle relative w-[18px] h-[18px] border-[1.5px] border-ink-2 rounded-[3px] bg-paper shrink-0"
  class:checkmark={checked}
  class:checkmark-red={checked && red}
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onclick={onclick}
  onkeydown={onclick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onclick(); } : undefined}
></span>

<style>
  .checkmark::after {
    content: '';
    position: absolute;
    left: 1px;
    top: -3px;
    width: 22px;
    height: 22px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 13 Q 8 22 12 16 T 22 2' stroke='%232a2620' stroke-width='2.5' fill='none' stroke-linecap='round'/></svg>");
    background-repeat: no-repeat;
  }
  .checkmark-red::after {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 13 Q 8 22 12 16 T 22 2' stroke='%23b54a3a' stroke-width='2.5' fill='none' stroke-linecap='round'/></svg>");
  }
</style>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/PencilCheckbox.spec.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PencilCheckbox.svelte src/lib/components/PencilCheckbox.spec.ts
git commit -m "feat(library): PencilCheckbox component with hand-drawn SVG mark"
```

---

### Task 7: Rank component

**Files:**
- Create: `src/lib/components/Rank.svelte`
- Test: `src/lib/components/Rank.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Rank from './Rank.svelte';

describe('Rank', () => {
  it('renders the numeral', () => {
    const { container } = render(Rank, { props: { n: 1 } });
    expect(container.textContent).toContain('1');
  });

  it('applies green tone classes', () => {
    const { container } = render(Rank, { props: { n: 1, tone: 'green' } });
    const el = container.querySelector('span');
    expect(el?.className).toMatch(/bg-green-soft/);
    expect(el?.className).toMatch(/border-green/);
  });

  it('applies red tone classes', () => {
    const { container } = render(Rank, { props: { n: 2, tone: 'red' } });
    const el = container.querySelector('span');
    expect(el?.className).toMatch(/bg-red-soft/);
  });

  it('applies indigo tone classes', () => {
    const { container } = render(Rank, { props: { n: 3, tone: 'indigo' } });
    const el = container.querySelector('span');
    expect(el?.className).toMatch(/bg-indigo-soft/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/Rank.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create Rank.svelte**

```svelte
<script lang="ts">
  type Tone = 'neutral' | 'green' | 'red' | 'indigo';
  const { n, tone = 'neutral' }: { n: number | string; tone?: Tone } = $props();
  // Full class names per the "no dynamic class names" Tailwind v4 rule
  const toneClasses = {
    neutral: 'bg-paper border-ink-2 text-ink',
    green: 'bg-green-soft border-green text-[#3c5320]',
    red: 'bg-red-soft border-red text-[#7a2418]',
    indigo: 'bg-indigo-soft border-indigo text-indigo',
  }[tone];
</script>

<span
  class="inline-flex items-center justify-center w-[28px] h-[28px] border-2 rounded-full font-display text-[18px] font-bold shrink-0 {toneClasses}"
>{n}</span>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/Rank.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Rank.svelte src/lib/components/Rank.spec.ts
git commit -m "feat(library): Rank tonal circle component"
```

---

### Task 8: Stamp component

**Files:**
- Create: `src/lib/components/Stamp.svelte`
- Test: `src/lib/components/Stamp.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Stamp from './Stamp.svelte';

describe('Stamp', () => {
  it('renders the label', () => {
    const { container } = render(Stamp, { props: { label: 'ARRIVED', tone: 'green' } });
    expect(container.textContent).toContain('ARRIVED');
  });

  it('applies -3deg rotation by default', () => {
    const { container } = render(Stamp, { props: { label: 'X', tone: 'green' } });
    const el = container.querySelector('span');
    expect(el?.getAttribute('style') || '').toContain('rotate(-3deg)');
  });

  it('applies red tone classes', () => {
    const { container } = render(Stamp, { props: { label: 'OVERDUE', tone: 'red' } });
    const el = container.querySelector('span');
    expect(el?.className).toMatch(/bg-red-soft/);
    expect(el?.className).toMatch(/border-red/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/Stamp.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create Stamp.svelte**

```svelte
<script lang="ts">
  type Tone = 'green' | 'red' | 'indigo';
  const { label, tone }: { label: string; tone: Tone } = $props();
  const toneClasses = {
    green: 'bg-green-soft border-green text-[#3c5320]',
    red: 'bg-red-soft border-red text-[#7a2418]',
    indigo: 'bg-indigo-soft border-indigo text-indigo',
  }[tone];
</script>

<span
  class="inline-block font-sans text-[11px] font-bold tracking-[0.14em] py-1 px-2.5 border-[1.5px] rounded-[3px] {toneClasses}"
  style="transform: rotate(-3deg)"
>{label}</span>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/Stamp.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Stamp.svelte src/lib/components/Stamp.spec.ts
git commit -m "feat(library): Stamp rotated label component"
```

---

### Task 9: Tally component

**Files:**
- Create: `src/lib/components/Tally.svelte`
- Test: `src/lib/components/Tally.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Tally from './Tally.svelte';

describe('Tally', () => {
  it('renders the numeral and label', () => {
    const { container } = render(Tally, { props: { n: 8, label: 'TICKED' } });
    expect(container.textContent).toContain('8');
    expect(container.textContent).toContain('TICKED');
  });

  it('numeral uses display font (Caveat)', () => {
    const { container } = render(Tally, { props: { n: 12, label: 'X' } });
    const num = container.querySelector('[data-tally-num]');
    expect(num?.className).toMatch(/font-display/);
  });

  it('applies red tone for negative state', () => {
    const { container } = render(Tally, { props: { n: 4, label: 'OVERDUE', tone: 'red' } });
    const num = container.querySelector('[data-tally-num]');
    expect(num?.className).toMatch(/text-red/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/Tally.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create Tally.svelte**

```svelte
<script lang="ts">
  type Tone = 'default' | 'red';
  const { n, label, tone = 'default' }: { n: number | string; label: string; tone?: Tone } = $props();
  const numClass = tone === 'red' ? 'text-red' : 'text-ink';
</script>

<div class="flex items-baseline gap-2">
  <span
    data-tally-num
    class="font-display font-bold text-[56px] leading-[0.9] {numClass}"
  >{n}</span>
  <span class="font-sans text-[11px] text-ink-3 tracking-[0.06em] uppercase">{label}</span>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/Tally.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Tally.svelte src/lib/components/Tally.spec.ts
git commit -m "feat(library): Tally big-Caveat numeral component"
```

---

### Task 10: WorkTitle component

**Files:**
- Create: `src/lib/components/WorkTitle.svelte`
- Test: `src/lib/components/WorkTitle.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import WorkTitle from './WorkTitle.svelte';

describe('WorkTitle', () => {
  it('renders composer and title with em-dash separator', () => {
    const work = { composer: 'Arvo Pärt', title: 'Magnificat' };
    const { container } = render(WorkTitle, { props: { work } });
    expect(container.textContent).toContain('Arvo Pärt');
    expect(container.textContent).toContain('Magnificat');
    expect(container.textContent).toMatch(/—/);
  });

  it('renders title in italics when italic prop is true (default)', () => {
    const work = { composer: 'X', title: 'Y' };
    const { container } = render(WorkTitle, { props: { work } });
    const titleEl = container.querySelector('[data-title]');
    expect(titleEl?.className).toMatch(/italic/);
  });

  it('respects size variants (s|m|l|xl)', () => {
    const work = { composer: 'X', title: 'Y' };
    const { container } = render(WorkTitle, { props: { work, size: 'xl' } });
    const outer = container.querySelector('[data-worktitle]');
    expect(outer?.className).toMatch(/text-\[24px\]/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/WorkTitle.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create WorkTitle.svelte**

```svelte
<script lang="ts">
  type Size = 's' | 'm' | 'l' | 'xl';
  const {
    work,
    size = 'm',
    italic = true,
  }: {
    work: { composer: string; title: string; title_alt?: string };
    size?: Size;
    italic?: boolean;
  } = $props();

  const sizeClass = {
    s: 'text-[13px]',
    m: 'text-[15px]',
    l: 'text-[19px]',
    xl: 'text-[24px]',
  }[size];
  const italicClass = italic ? 'italic' : '';
</script>

<span data-worktitle class="font-sans leading-tight text-ink {sizeClass}">
  <span class="font-semibold">{work.composer}</span>
  <span class="text-ink-3 mx-1">—</span>
  <span data-title class="{italicClass}">{work.title}</span>
  {#if work.title_alt}<span class="text-ink-4 font-sans text-[11px] ml-1.5">/ {work.title_alt}</span>{/if}
</span>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/WorkTitle.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/WorkTitle.svelte src/lib/components/WorkTitle.spec.ts
git commit -m "feat(library): WorkTitle component (composer — *title*)"
```

---

### Task 11: Margin component

**Files:**
- Create: `src/lib/components/Margin.svelte`
- Test: `src/lib/components/Margin.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Margin from './Margin.svelte';

describe('Margin', () => {
  it('renders slot content', () => {
    const { container } = render(Margin, {
      props: { rotate: 0, children: () => 'a note' },
    });
    expect(container.textContent).toContain('a note');
  });

  it('uses display font (Caveat)', () => {
    const { container } = render(Margin, { props: { rotate: 0, children: () => 'x' } });
    const el = container.querySelector('div');
    expect(el?.className).toMatch(/font-display/);
  });

  it('applies inline rotation transform', () => {
    const { container } = render(Margin, { props: { rotate: -1.5, children: () => 'x' } });
    const el = container.querySelector('div');
    expect(el?.getAttribute('style') || '').toContain('rotate(-1.5deg)');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/Margin.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create Margin.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  const {
    rotate = 0,
    children,
  }: { rotate?: number; children: Snippet } = $props();
</script>

<div class="font-display text-red text-[17px] leading-tight" style="transform: rotate({rotate}deg)">
  {@render children()}
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/Margin.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Margin.svelte src/lib/components/Margin.spec.ts
git commit -m "feat(library): Margin rotated marginalia (Caveat red)"
```

---

### Task 12: KeyHint component

**Files:**
- Create: `src/lib/components/KeyHint.svelte`
- Test: `src/lib/components/KeyHint.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import KeyHint from './KeyHint.svelte';

describe('KeyHint', () => {
  it('renders key and label', () => {
    const { container } = render(KeyHint, { props: { k: '⌘K', label: 'Search' } });
    expect(container.textContent).toContain('⌘K');
    expect(container.textContent).toContain('Search');
  });

  it('renders only the key when label is omitted', () => {
    const { container } = render(KeyHint, { props: { k: 'R' } });
    expect(container.textContent?.trim()).toBe('R');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/KeyHint.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create KeyHint.svelte**

```svelte
<script lang="ts">
  const { k, label = '' }: { k: string; label?: string } = $props();
</script>

<span class="inline-flex items-center gap-1.5 font-sans text-[11px] text-ink-3">
  <span class="inline-block min-w-[18px] px-1.5 h-[18px] leading-[16px] border border-[1.5px] border-b-[2.5px] border-ink-3 rounded font-mono text-[10px] bg-paper text-ink-2 text-center">{k}</span>
  {#if label}<span>{label}</span>{/if}
</span>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/KeyHint.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/KeyHint.svelte src/lib/components/KeyHint.spec.ts
git commit -m "feat(library): KeyHint keyboard-shortcut indicator"
```

---

### Task 13: BrandMark component

**Files:**
- Create: `src/lib/components/BrandMark.svelte`
- Test: `src/lib/components/BrandMark.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BrandMark from './BrandMark.svelte';

describe('BrandMark', () => {
  it('renders the m-tile and wordmark', () => {
    const { container } = render(BrandMark, { props: {} });
    expect(container.textContent).toContain('m');
    expect(container.textContent).toContain('mvox');
  });

  it('respects size variant', () => {
    const { container } = render(BrandMark, { props: { size: 'l' } });
    const wordmark = container.querySelector('[data-wordmark]');
    expect(wordmark?.className).toMatch(/text-\[22px\]/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/BrandMark.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create BrandMark.svelte**

```svelte
<script lang="ts">
  type Size = 's' | 'm' | 'l';
  const { size = 'm' }: { size?: Size } = $props();
  const tileSize = { s: 18, m: 24, l: 32 }[size];
  const tileFont = { s: 14, m: 18, l: 22 }[size];
  const wordSize = { s: 13, m: 15, l: 22 }[size];
</script>

<div class="inline-flex items-baseline gap-1.5">
  <span
    class="rounded-[7px] bg-ink text-paper font-display font-bold inline-flex items-center justify-center"
    style="width:{tileSize}px; height:{tileSize}px; font-size:{tileFont}px"
  >m</span>
  <span data-wordmark class="font-sans font-bold tracking-[-0.01em] text-ink" style="font-size:{wordSize}px">mvox</span>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/BrandMark.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/BrandMark.svelte src/lib/components/BrandMark.spec.ts
git commit -m "feat(library): BrandMark (mvox m-tile + wordmark)"
```

---

### Task 14: VoiceTally component

**Files:**
- Create: `src/lib/components/VoiceTally.svelte`
- Test: `src/lib/components/VoiceTally.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import VoiceTally from './VoiceTally.svelte';

describe('VoiceTally', () => {
  it('renders a voice badge and count per entry', () => {
    const counts = { S1: 8, A: 12, B: 10 } as const;
    const { container } = render(VoiceTally, { props: { counts } });
    expect(container.textContent).toContain('S1');
    expect(container.textContent).toContain('×8');
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('×12');
    expect(container.textContent).toContain('B');
    expect(container.textContent).toContain('×10');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/VoiceTally.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create VoiceTally.svelte**

```svelte
<script lang="ts">
  import Voice from './Voice.svelte';
  import type { Voice as VoiceType } from '$lib/types/library';

  const { counts }: { counts: Partial<Record<VoiceType, number>> } = $props();
  const entries = Object.entries(counts) as [VoiceType, number][];
</script>

<div class="inline-flex gap-2 items-center">
  {#each entries as [v, n] (v)}
    <span class="inline-flex items-center gap-1">
      <Voice {v} />
      <span class="font-mono text-[11px] text-ink-2">×{n}</span>
    </span>
  {/each}
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/VoiceTally.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/VoiceTally.svelte src/lib/components/VoiceTally.spec.ts
git commit -m "feat(library): VoiceTally horizontal counts strip"
```

---

### Task 15: CopyChip component

**Files:**
- Create: `src/lib/components/CopyChip.svelte`
- Test: `src/lib/components/CopyChip.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CopyChip from './CopyChip.svelte';

describe('CopyChip', () => {
  it('renders the copy number', () => {
    const { container } = render(CopyChip, { props: { n: '01', checked: false } });
    expect(container.textContent).toContain('01');
  });

  it('applies checked background and strike when checked', () => {
    const { container } = render(CopyChip, { props: { n: '01', checked: true } });
    const cell = container.querySelector('[data-cell]');
    expect(cell?.className).toMatch(/bg-green-soft\/40|bg-\[rgba\(95,122,59/);
    const num = container.querySelector('[data-num]');
    expect(num?.className).toMatch(/line-through|strike/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/CopyChip.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create CopyChip.svelte**

```svelte
<script lang="ts">
  import PencilCheckbox from './PencilCheckbox.svelte';
  const { n, checked }: { n: string; checked: boolean } = $props();
  const cellBg = checked ? 'bg-[rgba(95,122,59,0.12)]' : 'bg-paper';
  const numColor = checked ? 'text-ink-3 line-through' : 'text-ink';
</script>

<div data-cell class="flex items-center justify-center gap-1 px-1 py-1.5 border border-ink-5 rounded-[3px] {cellBg}">
  <PencilCheckbox {checked} />
  <span data-num class="font-mono text-[10px] font-semibold {numColor}">{n}</span>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/CopyChip.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/CopyChip.svelte src/lib/components/CopyChip.spec.ts
git commit -m "feat(library): CopyChip (checkbox + copy number cell)"
```

---

### Task 16: PencilSearch component

**Files:**
- Create: `src/lib/components/PencilSearch.svelte`
- Test: `src/lib/components/PencilSearch.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PencilSearch from './PencilSearch.svelte';

describe('PencilSearch', () => {
  it('renders the placeholder', () => {
    const { container } = render(PencilSearch, { props: { placeholder: 'Search…' } });
    const input = container.querySelector('input');
    expect(input?.placeholder).toBe('Search…');
  });

  it('renders the hint slot when provided', () => {
    const { container } = render(PencilSearch, { props: { placeholder: 'X', hint: '⌘K' } });
    expect(container.textContent).toContain('⌘K');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/PencilSearch.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create PencilSearch.svelte**

```svelte
<script lang="ts">
  const {
    placeholder = 'Search composer, work, edition…',
    hint = '',
  }: { placeholder?: string; hint?: string } = $props();
</script>

<div class="flex items-center gap-2 py-2 px-3 border-[1.5px] border-ink-2 rounded-md bg-paper shadow-[2px_2px_0_0_var(--color-ink-4)]">
  <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" class="text-ink-3">
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4-4" />
  </svg>
  <input
    type="search"
    {placeholder}
    class="flex-1 border-none outline-none bg-transparent font-sans text-[13px] text-ink placeholder:text-ink-4"
  />
  {#if hint}
    <span class="inline-block min-w-[18px] px-1.5 h-[18px] leading-[16px] border border-[1.5px] border-b-[2.5px] border-ink-3 rounded font-mono text-[10px] bg-paper text-ink-2 text-center">{hint}</span>
  {/if}
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/PencilSearch.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PencilSearch.svelte src/lib/components/PencilSearch.spec.ts
git commit -m "feat(library): PencilSearch sketch-styled search input"
```

---

### Task 17: PaperStack component

**Files:**
- Create: `src/lib/components/PaperStack.svelte`
- Test: `src/lib/components/PaperStack.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PaperStack from './PaperStack.svelte';

describe('PaperStack', () => {
  it('renders slot content', () => {
    const { container } = render(PaperStack, {
      props: { rotate: 0, children: () => 'stack body' },
    });
    expect(container.textContent).toContain('stack body');
  });

  it('applies inline rotation', () => {
    const { container } = render(PaperStack, {
      props: { rotate: -0.8, children: () => 'x' },
    });
    const el = container.querySelector('[data-stack]');
    expect(el?.getAttribute('style') || '').toContain('rotate(-0.8deg)');
  });

  it('applies red border when tone="red"', () => {
    const { container } = render(PaperStack, {
      props: { rotate: 0, tone: 'red', children: () => 'x' },
    });
    const el = container.querySelector('[data-stack]');
    expect(el?.className).toMatch(/border-red/);
  });

  it('STRETCH INVARIANT: does not declare fixed height (children determine size)', () => {
    const { container } = render(PaperStack, {
      props: { rotate: 0, children: () => 'x' },
    });
    const el = container.querySelector('[data-stack]') as HTMLElement;
    expect(el.style.height).toBe('');
    expect(el.style.minHeight).toBe('');
    expect(el.style.maxHeight).toBe('');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/PaperStack.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create PaperStack.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  type Tone = 'default' | 'red';
  const {
    rotate = 0,
    tone = 'default',
    children,
  }: { rotate?: number; tone?: Tone; children: Snippet } = $props();
  const borderClass = tone === 'red' ? 'border-red' : 'border-ink-2';
</script>

<!--
  PaperStack invariant: stretches to fit content. The wrapper is flex-column;
  pseudo-element shadows use inset:0 so they follow the wrapper's box automatically.
  Consumers may set min/max height inline; the primitive does not.
-->
<div
  data-stack
  class="bg-paper border-[1.5px] {borderClass} rounded relative shadow-[2px_3px_0_0_rgba(0,0,0,0.08)] flex flex-col"
  style="transform: rotate({rotate}deg)"
>
  <div class="absolute inset-0 -z-10 border-[1.5px] border-ink-2 rounded bg-paper" style="transform: rotate(-1.1deg) translate(2px, 3px)"></div>
  <div class="absolute inset-0 -z-20 border-[1.5px] border-ink-2 rounded bg-paper-2" style="transform: rotate(0.8deg) translate(-3px, 5px)"></div>
  <div class="px-3.5 py-4 flex flex-col h-full">
    {@render children()}
  </div>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/PaperStack.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PaperStack.svelte src/lib/components/PaperStack.spec.ts
git commit -m "feat(library): PaperStack 3-sheet wrapper (stretches to fit)"
```

---

### Task 18: StackHeader component

**Files:**
- Create: `src/lib/components/StackHeader.svelte`
- Test: `src/lib/components/StackHeader.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import StackHeader from './StackHeader.svelte';

describe('StackHeader', () => {
  it('renders rank, title, subtitle, and stamp', () => {
    const { container } = render(StackHeader, {
      props: { rank: 1, title: 'Returns', subtitle: 'back from December', tone: 'green', stamp: 'ARRIVED' },
    });
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('Returns');
    expect(container.textContent).toContain('back from December');
    expect(container.textContent).toContain('ARRIVED');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/StackHeader.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create StackHeader.svelte**

```svelte
<script lang="ts">
  import Rank from './Rank.svelte';
  import Stamp from './Stamp.svelte';
  type Tone = 'green' | 'red' | 'indigo';
  const {
    rank,
    title,
    subtitle,
    tone,
    stamp,
  }: { rank: number; title: string; subtitle: string; tone: Tone; stamp: string } = $props();
</script>

<div class="relative">
  <div class="flex items-center gap-2.5">
    <Rank n={rank} {tone} />
    <div class="flex-1">
      <div class="font-display text-[28px] font-bold text-ink leading-none tracking-[-0.01em]">{title}</div>
      <div class="font-sans text-[11px] text-ink-3">{subtitle}</div>
    </div>
    <Stamp label={stamp} {tone} />
  </div>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/StackHeader.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/StackHeader.svelte src/lib/components/StackHeader.spec.ts
git commit -m "feat(library): StackHeader (Rank + Caveat title + Stamp)"
```

---

### Task 19: PaperCard component (single-sheet variant, for auth)

**Files:**
- Create: `src/lib/components/PaperCard.svelte`
- Test: `src/lib/components/PaperCard.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PaperCard from './PaperCard.svelte';

describe('PaperCard', () => {
  it('renders slot content', () => {
    const { container } = render(PaperCard, {
      props: { rotate: 0, children: () => 'card body' },
    });
    expect(container.textContent).toContain('card body');
  });

  it('applies inline rotation', () => {
    const { container } = render(PaperCard, {
      props: { rotate: -0.6, children: () => 'x' },
    });
    const el = container.querySelector('[data-card]');
    expect(el?.getAttribute('style') || '').toContain('rotate(-0.6deg)');
  });

  it('STRETCH INVARIANT: no fixed height in primitive', () => {
    const { container } = render(PaperCard, {
      props: { rotate: 0, children: () => 'x' },
    });
    const el = container.querySelector('[data-card]') as HTMLElement;
    expect(el.style.height).toBe('');
    expect(el.style.minHeight).toBe('');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/PaperCard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create PaperCard.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  const {
    rotate = 0,
    width = '380px',
    children,
  }: { rotate?: number; width?: string; children: Snippet } = $props();
</script>

<div
  data-card
  class="bg-paper border-[1.5px] border-ink rounded-md p-8 shadow-[4px_6px_0_0_rgba(0,0,0,0.08)]"
  style="transform: rotate({rotate}deg); width: {width}"
>
  {@render children()}
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/PaperCard.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PaperCard.svelte src/lib/components/PaperCard.spec.ts
git commit -m "feat(library): PaperCard single-sheet wrapper (for auth screens)"
```

---

### Task 20: BorrowerCard component

**Files:**
- Create: `src/lib/components/BorrowerCard.svelte`
- Test: `src/lib/components/BorrowerCard.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BorrowerCard from './BorrowerCard.svelte';
import type { Member, Loan } from '$lib/types/library';

describe('BorrowerCard', () => {
  const member: Member = { id: 'hk', name: 'Henn Kuusik', voice: 'B2' };
  const loans: Loan[] = [
    { copy: '#14', member: 'hk', since: '2025-11-12', days_overdue: 195 },
    { copy: '#15', member: 'hk', since: '2025-11-12', days_overdue: 195 },
  ];

  it('renders avatar initials + name + voice + copies + days', () => {
    const { container } = render(BorrowerCard, { props: { member, loans } });
    expect(container.textContent).toContain('HK');
    expect(container.textContent).toContain('Henn Kuusik');
    expect(container.textContent).toContain('B2');
    expect(container.textContent).toContain('#14');
    expect(container.textContent).toContain('#15');
    expect(container.textContent).toContain('195');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/BorrowerCard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create BorrowerCard.svelte**

```svelte
<script lang="ts">
  import Voice from './Voice.svelte';
  import type { Member, Loan } from '$lib/types/library';
  const { member, loans }: { member: Member; loans: Loan[] } = $props();
  const initials = member.name.split(' ').map(s => s[0]).join('');
  const since = loans[0]?.since ?? '';
  const days = loans[0]?.days_overdue ?? 0;
</script>

<div class="px-2.5 py-2 bg-[rgba(181,74,58,0.08)] border border-red rounded-[3px] flex items-center gap-2">
  <div class="w-[30px] h-[30px] rounded-full bg-voice-b border border-[1.25px] border-ink-3 inline-flex items-center justify-center font-display text-[14px] font-bold shrink-0">{initials}</div>
  <div class="flex-1 min-w-0">
    <div class="font-sans text-[11px] font-semibold text-ink">{member.name} <Voice v={member.voice} /></div>
    <div class="font-mono text-[10px] text-ink-3">
      {loans.map(l => l.copy).join(' · ')} · out {since}
    </div>
    <div class="font-display text-[13px] text-red">{days} days overdue</div>
  </div>
  <div class="flex flex-col gap-1">
    <button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Nudge</button>
    <button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Return</button>
  </div>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/BorrowerCard.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/BorrowerCard.svelte src/lib/components/BorrowerCard.spec.ts
git commit -m "feat(library): BorrowerCard (overdue-stack body item)"
```

---

### Task 21: PullItemCard component

**Files:**
- Create: `src/lib/components/PullItemCard.svelte`
- Test: `src/lib/components/PullItemCard.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PullItemCard from './PullItemCard.svelte';
import type { Work } from '$lib/types/library';

const tormis: Work = {
  id: 'tormis-raua', composer: 'Veljo Tormis', title: 'Raua needmine', title_alt: 'Curse upon Iron',
  year: 1972, lang: 'Estonian', period: 'Contemporary', tags: [],
  editions: [{ id: 'raua-fg', label: 'Fennica Gehrman', voicing: 'SATB · drum', publisher: 'FG', year: 1991, total: 52, on_loan: 0, overdue: 0, returned_today: 0 }],
};

describe('PullItemCard', () => {
  it('renders composer, title, alt-title, and to-pull count', () => {
    const { container } = render(PullItemCard, {
      props: { work: tormis, edition: tormis.editions[0], pulled: 0, needed: 48 },
    });
    expect(container.textContent).toContain('Veljo Tormis');
    expect(container.textContent).toContain('Raua needmine');
    expect(container.textContent).toContain('Curse upon Iron');
    expect(container.textContent).toContain('48');
    expect(container.textContent).toContain('to pull');
  });

  it('renders done state when pulled >= needed', () => {
    const { container } = render(PullItemCard, {
      props: { work: tormis, edition: tormis.editions[0], pulled: 48, needed: 48 },
    });
    expect(container.textContent).toContain('pulled');
    expect(container.textContent).toContain('on the desk');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/PullItemCard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create PullItemCard.svelte**

```svelte
<script lang="ts">
  import PencilCheckbox from './PencilCheckbox.svelte';
  import type { Work, Edition } from '$lib/types/library';
  const { work, edition, pulled, needed }: { work: Work; edition: Edition; pulled: number; needed: number } = $props();
  const done = pulled >= needed;
  const bg = done ? 'bg-[rgba(95,122,59,0.10)] border-green' : 'bg-paper-2 border-ink-2';
  const tallyColor = done ? 'text-green' : 'text-ink';
  const labelColor = done ? 'text-green' : 'text-ink-3';
</script>

<div class="px-2.5 py-2 border-[1.5px] rounded-[3px] {bg}">
  <div class="flex items-start justify-between gap-2">
    <div class="flex-1 flex items-start gap-1.5">
      <span class="mt-0.5"><PencilCheckbox checked={done} /></span>
      <div class="flex-1">
        <div class="font-sans text-[11.5px] font-semibold text-ink">{work.composer}</div>
        <div class="font-sans text-[11.5px] italic text-ink leading-tight">{work.title}</div>
        {#if work.title_alt}<div class="font-sans text-[10px] text-ink-4">/ {work.title_alt}</div>{/if}
      </div>
    </div>
    <div class="text-right">
      <div class="font-display font-bold text-[28px] {tallyColor} leading-none">{done ? pulled : needed}</div>
      <div class="font-sans text-[8px] uppercase tracking-wider {labelColor}">{done ? 'pulled' : 'to pull'}</div>
    </div>
  </div>
  {#if done}
    <div class="flex justify-end items-center gap-1.5 mt-2">
      <span class="font-display text-[12px] text-green mr-auto">✓ on the desk</span>
      <button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Undo</button>
    </div>
  {:else}
    <div class="flex justify-end gap-1.5 mt-2">
      <button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Locate</button>
      <button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Skip</button>
      <button type="button" class="text-[10px] py-0.5 px-2 border-[1.5px] border-ink bg-ink text-paper rounded-[3px]">Pull {needed} →</button>
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/PullItemCard.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PullItemCard.svelte src/lib/components/PullItemCard.spec.ts
git commit -m "feat(library): PullItemCard (pull-stack per-work item)"
```

---

### Task 22: MiniWorkCard component

**Files:**
- Create: `src/lib/components/MiniWorkCard.svelte`
- Test: `src/lib/components/MiniWorkCard.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MiniWorkCard from './MiniWorkCard.svelte';
import type { Work } from '$lib/types/library';

const w: Work = {
  id: 'tallis-spem', composer: 'Thomas Tallis', title: 'Spem in alium',
  year: 1570, lang: 'Latin', period: 'Renaissance', tags: [],
  editions: [{ id: 'tallis-40', label: '40-part', voicing: '40-v', publisher: 'CN', year: 1928, total: 12, on_loan: 0, overdue: 0, returned_today: 0 }],
};

describe('MiniWorkCard', () => {
  it('renders composer, title, voicing, stats', () => {
    const { container } = render(MiniWorkCard, { props: { work: w } });
    expect(container.textContent).toContain('Thomas Tallis');
    expect(container.textContent).toContain('Spem in alium');
    expect(container.textContent).toContain('40-v');
    expect(container.textContent).toContain('12/12');
  });

  it('shows overdue indicator when pinnedTone="overdue"', () => {
    const overdue: Work = { ...w, editions: [{ ...w.editions[0], on_loan: 4, overdue: 4 }] };
    const { container } = render(MiniWorkCard, { props: { work: overdue, pinnedTone: 'overdue' } });
    const card = container.querySelector('[data-card]');
    expect(card?.className).toMatch(/border-t-\[3px\]|border-red/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/MiniWorkCard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create MiniWorkCard.svelte**

```svelte
<script lang="ts">
  import type { Work } from '$lib/types/library';
  import { workStats } from '$lib/library/derive';
  type PinnedTone = 'overdue' | 'tonight' | 'returns' | undefined;
  const { work, pinnedTone }: { work: Work; pinnedTone?: PinnedTone } = $props();
  const s = workStats(work);
  const topBorder = pinnedTone === 'overdue' ? 'border-t-[3px] border-t-red' : '';
  const fractionColor = s.overdue > 0 ? 'text-red' : (s.available > 0 ? 'text-green' : 'text-ink-3');
</script>

<div data-card class="px-2 py-1.5 bg-paper border border-ink-4 rounded-[3px] shadow-[1px_1px_0_0_var(--color-ink-5)] font-sans text-[10px] text-ink {topBorder}">
  <div class="font-semibold leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{work.composer}</div>
  <div class="italic text-ink-2 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{work.title}</div>
  <div class="flex justify-between mt-1 font-mono text-[9px] text-ink-3">
    <span>{work.editions[0].voicing}</span>
    {#if s.has_limitless && s.total === 0}
      <span class="italic text-indigo">∞</span>
    {:else}
      <span class={fractionColor}>{s.available}/{s.total}</span>
    {/if}
  </div>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/MiniWorkCard.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MiniWorkCard.svelte src/lib/components/MiniWorkCard.spec.ts
git commit -m "feat(library): MiniWorkCard (ambient catalog strip item)"
```

---

### Task 23: DeskSurface component

**Files:**
- Create: `src/lib/components/DeskSurface.svelte`
- Test: `src/lib/components/DeskSurface.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DeskSurface from './DeskSurface.svelte';

describe('DeskSurface', () => {
  it('renders slot content', () => {
    const { container } = render(DeskSurface, { props: { children: () => 'desk content' } });
    expect(container.textContent).toContain('desk content');
  });

  it('inlines the repeating-linear-gradient wood-grain', () => {
    const { container } = render(DeskSurface, { props: { children: () => 'x' } });
    const el = container.querySelector('[data-desk]');
    const style = el?.getAttribute('style') || '';
    expect(style).toContain('repeating-linear-gradient');
    expect(style).toContain('110deg');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/DeskSurface.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create DeskSurface.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  const { children }: { children: Snippet } = $props();
</script>

<div
  data-desk
  class="w-full"
  style="
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255,235,180,0.4), transparent 60%),
      radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.06), transparent 50%),
      repeating-linear-gradient(110deg, #d6c39a 0 2px, #d8c79e 2px 6px, #d4be94 6px 10px),
      #d3bf95;
  "
>
  {@render children()}
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/DeskSurface.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/DeskSurface.svelte src/lib/components/DeskSurface.spec.ts
git commit -m "feat(library): DeskSurface wood-grain background wrapper"
```

---

### Task 24: MvoxNav component (replaces existing layout nav)

**Files:**
- Create: `src/lib/components/MvoxNav.svelte`
- Test: `src/lib/components/MvoxNav.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MvoxNav from './MvoxNav.svelte';

describe('MvoxNav', () => {
  it('renders brand and section tabs', () => {
    const { container } = render(MvoxNav, { props: { signedIn: true, currentTab: 'library', orgLabel: 'Estonian Philharmonic Chamber Choir', orgInitials: 'EP', userInitial: 'M', userName: 'Maire L.' } });
    expect(container.textContent).toContain('mvox');
    expect(container.textContent).toContain('agenda');
    expect(container.textContent).toContain('library');
    expect(container.textContent).toContain('Maire L.');
  });

  it('shows LIBRARIAN role chip when on library tab and signed in', () => {
    const { container } = render(MvoxNav, { props: { signedIn: true, currentTab: 'library', orgLabel: 'X', orgInitials: 'X', userInitial: 'X', userName: 'X' } });
    expect(container.textContent).toContain('LIBRARIAN');
  });

  it('does not render user pill when not signed in', () => {
    const { container } = render(MvoxNav, { props: { signedIn: false, currentTab: 'library' } });
    expect(container.textContent).not.toContain('Maire');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/MvoxNav.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create MvoxNav.svelte**

```svelte
<script lang="ts">
  import BrandMark from './BrandMark.svelte';
  type Tab = 'agenda' | 'library' | 'roster' | 'notices' | 'settings';
  const TABS: Tab[] = ['agenda', 'library', 'roster', 'notices', 'settings'];
  const {
    signedIn,
    currentTab,
    orgLabel = '',
    orgInitials = '',
    userInitial = '',
    userName = '',
  }: {
    signedIn: boolean;
    currentTab: Tab;
    orgLabel?: string;
    orgInitials?: string;
    userInitial?: string;
    userName?: string;
  } = $props();
</script>

<header class="flex items-center justify-between py-2 px-6 border-b-[1.5px] border-ink-2 bg-paper">
  <div class="flex items-center gap-4">
    <a href="/"><BrandMark size="m" /></a>
    {#if signedIn && orgLabel}
      <span class="text-ink-4">/</span>
      <span class="inline-flex items-center gap-1.5 py-0.5 px-2 border border-[1.25px] border-ink-3 rounded">
        <span class="w-[16px] h-[16px] rounded-[3px] bg-[#293556] text-white font-sans font-bold text-[7px] inline-flex items-center justify-center">{orgInitials}</span>
        <span class="font-sans font-semibold text-[11px]">{orgLabel}</span>
        <span class="text-ink-4">▾</span>
      </span>
    {/if}
  </div>
  <div class="flex items-center gap-3.5">
    {#if signedIn}
      <div class="flex gap-3">
        {#each TABS as tab (tab)}
          <span class="font-sans text-[11.5px] {tab === currentTab ? 'text-ink font-semibold border-b-2 border-ink pb-1' : 'text-ink-3 font-medium'} inline-flex items-center gap-1">
            {tab}
            {#if tab === 'library' && tab === currentTab}
              <span class="font-sans text-[7px] tracking-wider py-px px-1 bg-ink text-paper rounded-sm font-semibold">LIBRARIAN</span>
            {/if}
          </span>
        {/each}
      </div>
      <span class="text-ink-4">·</span>
      <span class="inline-flex items-center gap-1.5 font-sans text-[11.5px]">
        <span class="w-[22px] h-[22px] rounded-full bg-[#c8b290] border border-ink-3 inline-flex items-center justify-center font-display text-[13px] font-bold">{userInitial}</span>
        <span class="font-medium">{userName}</span>
      </span>
    {:else}
      <a href="/auth/login" class="font-sans text-[11.5px] text-ink-3">Sign in</a>
    {/if}
  </div>
</header>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/MvoxNav.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MvoxNav.svelte src/lib/components/MvoxNav.spec.ts
git commit -m "feat(library): MvoxNav component (replaces inline layout nav)"
```

---

### Task 25: ProviderButton component

**Files:**
- Create: `src/lib/components/ProviderButton.svelte`
- Test: `src/lib/components/ProviderButton.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ProviderButton from './ProviderButton.svelte';

describe('ProviderButton', () => {
  it('renders provider name', () => {
    const { container } = render(ProviderButton, {
      props: { providerId: 'google', name: 'Continue with Google', href: '/auth/google' },
    });
    expect(container.textContent).toContain('Continue with Google');
  });

  it('renders sub-label when provided', () => {
    const { container } = render(ProviderButton, {
      props: { providerId: 'smart-id', name: 'Smart-ID', sub: 'EE/LV/LT', href: '/auth/smart-id' },
    });
    expect(container.textContent).toContain('EE/LV/LT');
  });

  it('applies featured background class when featured=true', () => {
    const { container } = render(ProviderButton, {
      props: { providerId: 'google', name: 'Google', href: '/x', featured: true },
    });
    const el = container.querySelector('a');
    expect(el?.className).toMatch(/bg-highlight/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/lib/components/ProviderButton.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create ProviderButton.svelte**

```svelte
<script lang="ts">
  type ProviderId = 'smart-id' | 'mobile-id' | 'id-card' | 'google' | 'apple' | 'e-mail';
  const {
    providerId,
    name,
    sub = '',
    href,
    featured = false,
    testId = '',
  }: { providerId: ProviderId; name: string; sub?: string; href: string; featured?: boolean; testId?: string } = $props();
  const bg = featured
    ? 'bg-highlight border-ink shadow-[3px_3px_0_0_var(--color-ink-2)]'
    : 'bg-paper border-ink-2 shadow-[2px_2px_0_0_var(--color-ink-4)]';
  const iconBg = {
    'smart-id': 'bg-[#003b95] text-white',
    'mobile-id': 'bg-[#003b95] text-white',
    'id-card': 'bg-[#003b95] text-white',
    'google': 'bg-[#4285f4] text-white',
    'apple': 'bg-paper text-ink',
    'e-mail': 'bg-paper text-ink',
  }[providerId];
  const iconLabel = {
    'smart-id': 'ID',
    'mobile-id': 'M·ID',
    'id-card': 'ID',
    'google': 'G',
    'apple': '',
    'e-mail': '✉',
  }[providerId];
</script>

<a
  {href}
  data-testid={testId}
  class="flex items-center gap-3 py-2.5 px-3.5 border-[1.5px] rounded font-sans text-[13px] text-ink w-full text-left transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] {bg}"
>
  <span class="w-5 h-5 inline-flex items-center justify-center font-bold text-[12px] rounded-sm {iconBg}">{iconLabel}</span>
  <span class="flex-1 font-medium">{name}</span>
  {#if sub}<span class="font-mono text-[10.5px] text-ink-3">{sub}</span>{/if}
</a>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/lib/components/ProviderButton.spec.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ProviderButton.svelte src/lib/components/ProviderButton.spec.ts
git commit -m "feat(library): ProviderButton component (auth OAuth button)"
```

---

### Task 26: Layout restructure + nested library layout

**Files:**
- Modify: `src/routes/+layout.svelte` (remove inner max-w-5xl wrapper)
- Create: `src/routes/library/+layout.svelte` (no max-w wrapper)
- Test: extend existing layout coverage indirectly via page.spec.ts in Task 27

- [ ] **Step 1: Modify `src/routes/+layout.svelte` to remove the page-content wrapper**

Replace the entire file with:

```svelte
<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getToken } from '$lib/auth/storage';
  import * as m from '$lib/paraglide/messages.js';
  import MvoxNav from '$lib/components/MvoxNav.svelte';

  let { children } = $props();

  let mounted = $state(false);
  let signedIn = $state(false);

  function refreshSignedIn() {
    signedIn = getToken() !== null;
  }

  onMount(() => {
    refreshSignedIn();
    mounted = true;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === null) refreshSignedIn();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  $effect(() => {
    $page.url;
    refreshSignedIn();
  });

  const currentTab = $derived(
    $page.url.pathname.startsWith('/library') ? 'library' :
    $page.url.pathname.startsWith('/roster') ? 'roster' :
    $page.url.pathname.startsWith('/notices') ? 'notices' :
    $page.url.pathname.startsWith('/settings') ? 'settings' :
    'agenda'
  );
</script>

{#if mounted}
  <MvoxNav signedIn={signedIn} currentTab={currentTab} userInitial="M" userName="Maire L." orgLabel="Estonian Philharmonic Chamber Choir" orgInitials="EP" />
{/if}

{@render children()}
```

- [ ] **Step 2: Create `src/routes/library/+layout.svelte` (no inner wrapper)**

```svelte
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```

- [ ] **Step 3: Run `pnpm dev` and visit `/` to verify the nav still renders + the landing page still works without the max-w-5xl wrapper**

Run: `pnpm dev`
Expected: dev server starts; visit `http://localhost:5173/` and verify the nav at top, sign-in/out link visible per state, landing content renders.

- [ ] **Step 4: Run full test suite + check**

Run: `pnpm test:unit && pnpm check`
Expected: PASS (existing page tests should still pass; if any depended on max-w-5xl wrapper, update them.)

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte src/routes/library/+layout.svelte
git commit -m "feat(library): restructure layout for nested /library escape from max-w-5xl"
```

---

### Task 27: /library page composition

**Files:**
- Create: `src/routes/library/+page.svelte`
- Test: `src/routes/library/page.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/library/page.spec.ts`:

```typescript
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('/library +page', () => {
  it('renders the three task stacks (Returns / Overdue / Pull for tonight)', () => {
    const { container } = render(Page);
    expect(container.textContent).toContain('Returns');
    expect(container.textContent).toContain('Overdue');
    expect(container.textContent).toContain('Pull for tonight');
    expect(container.textContent).toContain('ARRIVED');
    expect(container.textContent).toContain('OVERDUE');
    expect(container.textContent).toContain('TONIGHT');
  });

  it('renders the top strip with "On the desk today"', () => {
    const { container } = render(Page);
    expect(container.textContent).toContain('On the desk today');
    expect(container.textContent).toContain("librarian's desk");
  });

  it('renders the ambient catalog strip with stats', () => {
    const { container } = render(Page);
    expect(container.textContent).toContain('Catalog · 13 works');
    expect(container.textContent).toContain('Open full catalog');
  });

  it('renders specific bundle content (Tallis, Pärt, Tormis)', () => {
    const { container } = render(Page);
    expect(container.textContent).toContain('Thomas Tallis');
    expect(container.textContent).toContain('Arvo Pärt');
    expect(container.textContent).toContain('Veljo Tormis');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/routes/library/page.spec.ts`
Expected: FAIL — page doesn't exist.

- [ ] **Step 3: Create `src/routes/library/+page.svelte`**

```svelte
<script lang="ts">
  import { CHOIR, TODAY, MEMBERS, WORKS, TASKS } from '$lib/fixtures/library-mock';
  import { libStats, workById, byMemberId } from '$lib/library/derive';
  import DeskSurface from '$lib/components/DeskSurface.svelte';
  import PaperStack from '$lib/components/PaperStack.svelte';
  import StackHeader from '$lib/components/StackHeader.svelte';
  import PencilSearch from '$lib/components/PencilSearch.svelte';
  import WorkTitle from '$lib/components/WorkTitle.svelte';
  import CopyChip from '$lib/components/CopyChip.svelte';
  import BorrowerCard from '$lib/components/BorrowerCard.svelte';
  import PullItemCard from '$lib/components/PullItemCard.svelte';
  import VoiceTally from '$lib/components/VoiceTally.svelte';
  import Margin from '$lib/components/Margin.svelte';
  import MiniWorkCard from '$lib/components/MiniWorkCard.svelte';
  import Tally from '$lib/components/Tally.svelte';

  const returnsTask = TASKS.find(t => t.id === 'returns')!;
  const overdueTask = TASKS.find(t => t.id === 'overdue')!;
  const pullTask = TASKS.find(t => t.id === 'pull')!;

  const tallisWork = workById(WORKS, returnsTask.work_id!)!;
  const tallisEdition = tallisWork.editions[0];
  const tallisCopies = Array.from({ length: tallisEdition.total }, (_, i) => ({
    n: String(i + 1).padStart(2, '0'),
    checked: i < (returnsTask.confirmed ?? 0),
  }));

  const partWork = workById(WORKS, overdueTask.work_id!)!;
  const partEdition = partWork.editions[0];
  const overdueLoans = partEdition.loans ?? [];

  const stats = libStats(WORKS);
</script>

<DeskSurface>
  <div class="flex flex-col">
    <div class="flex items-center justify-between py-3 px-7 bg-paper/80 border-b-[1.5px] border-ink-2">
      <div>
        <div class="font-sans text-[10px] tracking-[0.16em] uppercase text-ink-3 font-semibold">Library · librarian's desk</div>
        <div class="font-display text-[30px] font-bold text-ink leading-none tracking-[-0.01em] mt-0.5">On the desk today</div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <div class="font-sans text-[11px] text-ink-3">{TODAY.date} · <span class="text-ink">{TODAY.time}</span></div>
          <div class="font-display text-[15px] text-red mt-0.5">Rehearsal 16:00 · in <strong>1h 28m</strong></div>
        </div>
        <div class="w-[280px]"><PencilSearch placeholder="⌘K · jump to work, copy #, borrower…" /></div>
      </div>
    </div>

    <div class="px-6 py-6 grid gap-5" style="grid-template-columns: 1fr 1fr 1.15fr">
      <!-- Returns stack -->
      <PaperStack rotate={-0.8}>
        <StackHeader rank={1} title="Returns" subtitle="back from December" tone="green" stamp="ARRIVED" />
        <div class="pt-2"><WorkTitle work={tallisWork} size="s" /></div>
        <div class="font-mono text-[9px] text-ink-3 mt-0.5">{tallisEdition.publisher} {tallisEdition.year}</div>
        <div class="mt-2 px-2 py-1.5 bg-paper-2 border border-dashed border-ink-4 rounded-[3px]">
          <div class="flex justify-between items-baseline mb-1.5">
            <span class="font-sans text-[8px] tracking-[0.14em] uppercase text-ink-3 font-semibold">Folder · Bass section</span>
            <span class="font-display text-[11px] text-ink-3">{tallisEdition.total} counted</span>
          </div>
          <div class="grid grid-cols-6 gap-1">
            {#each tallisCopies as c (c.n)}<CopyChip n={c.n} checked={c.checked} />{/each}
          </div>
        </div>
        <div class="flex-1"></div>
        <div class="flex justify-between items-center pt-2 border-t border-dashed border-ink-5 mt-2">
          <div>
            <span class="font-display font-bold text-[26px] text-ink leading-none">{returnsTask.confirmed}</span>
            <span class="font-display text-[14px] text-ink-3">/{returnsTask.count}</span>
            <div class="font-sans text-[8px] tracking-wider uppercase text-ink-3">ticked</div>
          </div>
          <button type="button" class="py-1 px-2.5 border-[1.5px] border-ink bg-ink text-paper rounded-[3px] text-[11px]">Confirm {returnsTask.pending} ✓</button>
        </div>
      </PaperStack>

      <!-- Overdue stack -->
      <PaperStack rotate={0.6} tone="red">
        <StackHeader rank={2} title="Overdue" subtitle="basses still hold these" tone="red" stamp="OVERDUE" />
        <div class="pt-2"><WorkTitle work={partWork} size="s" /></div>
        <div class="font-mono text-[9px] text-ink-3 mt-0.5">{partEdition.publisher} {partEdition.year}{partEdition.isbn ? ' · ' + partEdition.isbn : ''}</div>
        <div class="mt-2 flex flex-col gap-1.5">
          {#each (overdueTask.borrowers ?? []) as bid (bid)}
            {@const member = byMemberId(MEMBERS, bid)}
            {@const memberLoans = overdueLoans.filter(l => l.member === bid)}
            {#if member}
              <BorrowerCard {member} loans={memberLoans} />
            {/if}
          {/each}
        </div>
        <div class="absolute top-9 right-3.5 text-right">
          <Margin rotate={8}>owe rental library<br/>if not back by 31 May</Margin>
        </div>
        <div class="flex-1"></div>
        <div class="flex justify-between items-center pt-2 border-t border-dashed border-ink-5 mt-2">
          <div>
            <span class="font-display font-bold text-[26px] text-red leading-none">{overdueTask.count}</span>
            <div class="font-sans text-[8px] tracking-wider uppercase text-red">copies out</div>
          </div>
          <button type="button" class="py-1 px-2.5 border-[1.5px] border-red bg-paper text-red rounded-[3px] text-[11px]">Nudge both ✉</button>
        </div>
      </PaperStack>

      <!-- Pull stack -->
      <PaperStack rotate={-0.3}>
        <StackHeader rank={3} title="Pull for tonight" subtitle="48 singers · stack on the desk" tone="indigo" stamp="TONIGHT" />
        <div class="font-sans text-[10.5px] text-ink-3 mt-2">Conductor's request · Tue {TODAY.date.slice(0,6)} · 16:00</div>
        <div class="mt-2 flex flex-col gap-1.5 flex-1">
          {#each (pullTask.work_ids ?? []) as wid (wid)}
            {@const w = workById(WORKS, wid)}
            {@const e = w?.editions[0]}
            {@const pulled = pullTask.pulled?.[wid] ?? 0}
            {#if w && e}
              <PullItemCard work={w} edition={e} {pulled} needed={CHOIR.rehearsal_size} />
            {/if}
          {/each}
        </div>
        <div class="mt-2 px-2 py-1.5 bg-paper-2 rounded-[3px] border border-dashed border-ink-5 flex justify-between items-center font-sans text-[9px] text-ink-3">
          <span>Singers tonight</span>
          <VoiceTally counts={{ S1: 8, S2: 8, A: 12, T1: 5, T2: 5, B1: 5, B2: 5 }} />
        </div>
      </PaperStack>
    </div>
  </div>
</DeskSurface>

<!-- Ambient catalog strip -->
<div class="border-t-[1.5px] border-ink-2 bg-paper-2 px-6 py-3">
  <div class="flex justify-between items-center mb-2 font-sans">
    <div class="flex items-baseline gap-3">
      <span class="text-[10px] tracking-[0.14em] uppercase text-ink-3 font-semibold">Catalog · {stats.works} works</span>
      <span class="text-[11px] text-ink-3">
        <span class="text-ink font-semibold">{stats.copies}</span> copies owned ·
        <span class="text-green font-semibold">{stats.available}</span> available ·
        <span class="text-amber font-semibold">{stats.on_loan}</span> on loan ·
        <span class="text-red font-semibold">{stats.overdue}</span> overdue
      </span>
    </div>
    <a href="/library/catalog" class="text-[11px] text-ink underline font-medium">Open full catalog ↗</a>
  </div>
  <div class="grid grid-cols-6 gap-1.5">
    {#each WORKS.slice(0, 6) as w (w.id)}
      <MiniWorkCard work={w} pinnedTone={w.id === 'part-magnificat' ? 'overdue' : undefined} />
    {/each}
  </div>
</div>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/routes/library/page.spec.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Visual hand-verify on dev server**

Run: `pnpm dev`
Open `http://localhost:5173/library` in a browser. Verify:
- Wood-grain desk surface spans full viewport width
- Three paper stacks (Returns / Overdue / Pull) render with rotation + stamps
- Top strip + ambient catalog strip render correctly
- No console errors
- Matches the approved composition mockup intent

- [ ] **Step 6: Commit**

```bash
git add src/routes/library/+page.svelte src/routes/library/page.spec.ts
git commit -m "feat(library): compose /library page from UI kit"
```

---

### Task 28: /auth/login redesign

**Files:**
- Modify: `src/routes/auth/login/+page.svelte` (preserve all CHORE-B logic)
- No new test (existing tests on the data prop still apply)

- [ ] **Step 1: Replace the entire contents of `src/routes/auth/login/+page.svelte`**

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getLastProvider } from '$lib/auth/storage';
  import * as m from '$lib/paraglide/messages.js';
  import DeskSurface from '$lib/components/DeskSurface.svelte';
  import PaperCard from '$lib/components/PaperCard.svelte';
  import BrandMark from '$lib/components/BrandMark.svelte';
  import ProviderButton from '$lib/components/ProviderButton.svelte';
  import Margin from '$lib/components/Margin.svelte';

  const { data } = $props<{ data: { providers: Array<{ id: string; label: string }> } }>();

  const error = $derived(page.url.searchParams.get('error'));
  const returnTo = $derived(page.url.searchParams.get('return_to') ?? '/');
  const lastProvider = $state(typeof window !== 'undefined' ? getLastProvider() : null);

  onMount(() => {
    if (error) return;
    if (page.url.searchParams.get('picker') === '1') return;

    const remembered = getLastProvider();
    if (remembered) {
      goto(`/auth/${remembered}?return_to=${encodeURIComponent(returnTo)}&intent=reauth`);
    }
  });

  const PROVIDER_NAMES: Record<string, { name: string; sub: string }> = {
    'smart-id': { name: 'Smart-ID', sub: 'EE/LV/LT' },
    'mobile-id': { name: 'Mobile-ID', sub: 'EE' },
    'id-card': { name: 'ID-card', sub: 'EE' },
    'google': { name: 'Continue with Google', sub: '' },
    'apple': { name: 'Apple', sub: '' },
    'e-mail': { name: 'E-mail', sub: 'magic link' },
  };

  const ordered = $derived(
    lastProvider
      ? [
          data.providers.find((p) => p.id === lastProvider),
          ...data.providers.filter((p) => p.id !== lastProvider),
        ].filter((p): p is { id: string; label: string } => p != null)
      : data.providers
  );
</script>

<DeskSurface>
  <div class="min-h-[80vh] flex flex-col items-center justify-center gap-5 py-12 px-6">
    <PaperCard rotate={-0.6}>
      <BrandMark size="m" />
      <div class="font-sans text-[10px] tracking-[0.16em] uppercase text-ink-3 font-semibold mt-4">{m.auth_login_eyebrow()}</div>
      <div class="font-display text-[38px] font-bold text-ink leading-none tracking-[-0.01em] mt-0.5">{m.auth_login_heading()}</div>
      <div class="font-sans text-[12px] text-ink-3 mt-1.5">{m.auth_login_subtitle()}</div>

      {#if error}
        <div class="mt-5 rounded-md bg-red-soft px-3 py-2 text-[12px] text-[#7a2418] border border-red" role="alert">
          {#if error === 'csrf_mismatch'}{m.auth_error_csrf_mismatch()}
          {:else if error === 'missing_session_token'}{m.auth_error_missing_session_token()}
          {:else}{m.common_error()}{/if}
        </div>
      {/if}

      {#if lastProvider && !error}
        <div class="font-sans text-[9px] tracking-[0.14em] uppercase text-ink-3 font-semibold mt-6 mb-2">{m.auth_login_last_used()}</div>
        {@const lp = data.providers.find((p) => p.id === lastProvider)}
        {#if lp}
          {@const meta = PROVIDER_NAMES[lp.id] ?? { name: lp.label, sub: '' }}
          <ProviderButton providerId={lp.id as any} name={meta.name} sub={meta.sub} featured testId={`provider-${lp.id}`} href={`/auth/${lp.id}?return_to=${encodeURIComponent(returnTo)}&intent=reauth`} />
        {/if}
        <div class="font-sans text-[9px] tracking-[0.14em] uppercase text-ink-3 font-semibold mt-6 mb-2">{m.auth_login_all_providers()}</div>
      {/if}

      <div class="flex flex-col gap-2 mt-{lastProvider && !error ? '0' : '5'}">
        {#each ordered.filter(p => !lastProvider || p.id !== lastProvider) as provider (provider.id)}
          {@const meta = PROVIDER_NAMES[provider.id] ?? { name: provider.label, sub: '' }}
          <ProviderButton providerId={provider.id as any} name={meta.name} sub={meta.sub} testId={`provider-${provider.id}`} href={`/auth/${provider.id}?return_to=${encodeURIComponent(returnTo)}&intent=login`} />
        {/each}
      </div>

      <div class="font-sans text-[11px] text-ink-3 mt-6 pt-3.5 border-t border-dashed border-ink-5 leading-snug">{m.auth_login_footnote()}</div>
    </PaperCard>
    <Margin rotate={-1.5}>~ multivox.pages.dev · v0.4</Margin>
  </div>
</DeskSurface>
```

- [ ] **Step 2: Run existing tests + check**

Run: `pnpm test:unit && pnpm check`
Expected: PASS — existing storage / page-server tests still pass; type check clean. The page-data shape (`{ providers }`) is unchanged.

- [ ] **Step 3: Visual hand-verify**

Run: `pnpm dev`
Visit `http://localhost:5173/auth/login?picker=1` (force picker rather than auto-redirect). Verify:
- Paper card on wood-grain desk, slight rotation
- BrandMark top-left
- "Welcome back" Caveat heading
- 6 provider buttons styled with sketch chrome
- If a `lastProvider` is in localStorage: that provider appears as featured (highlight bg)
- Footnote text below dashed divider
- "~ multivox.pages.dev · v0.4" Caveat marginalia below the card

- [ ] **Step 4: Commit**

```bash
git add src/routes/auth/login/+page.svelte
git commit -m "feat(library): /auth/login redesign on the design system"
```

---

### Task 29: /auth/logout redesign

**Files:**
- Modify: `src/routes/auth/logout/+page.svelte` (preserve performLogout + add 5s redirect with Esc-to-cancel)
- Modify: `src/routes/auth/logout/page.spec.ts` (update for new behavior if needed)

- [ ] **Step 1: Replace the entire contents of `src/routes/auth/logout/+page.svelte`**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { performLogout } from './perform-logout';
  import * as m from '$lib/paraglide/messages.js';
  import DeskSurface from '$lib/components/DeskSurface.svelte';
  import PaperCard from '$lib/components/PaperCard.svelte';
  import BrandMark from '$lib/components/BrandMark.svelte';
  import Stamp from '$lib/components/Stamp.svelte';
  import ProviderButton from '$lib/components/ProviderButton.svelte';
  import Margin from '$lib/components/Margin.svelte';

  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = $state(false);

  onMount(() => {
    performLogout();
    timer = setTimeout(() => goto('/'), 5000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && timer) {
        clearTimeout(timer);
        timer = null;
        cancelled = true;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timer) clearTimeout(timer);
    };
  });
</script>

<DeskSurface>
  <div class="min-h-[80vh] flex flex-col items-center justify-center gap-5 py-12 px-6">
    <PaperCard rotate={0.4}>
      <BrandMark size="m" />
      <div class="flex items-center justify-center mt-8">
        <Stamp label={m.auth_logout_stamp()} tone="green" />
      </div>
      <div class="font-display text-[42px] font-bold text-ink leading-none tracking-[-0.01em] mt-7 text-center">{m.auth_logout_heading()}</div>
      <div class="font-sans text-[12px] text-ink-3 mt-2 text-center leading-snug">{m.auth_logout_subtitle()}</div>
      <div class="mt-6 pt-4 border-t border-dashed border-ink-5 flex flex-col gap-2">
        <ProviderButton providerId="google" name={m.auth_logout_sign_back_in()} href="/auth/login" featured />
        <a href="/" class="font-sans text-[11.5px] text-ink-3 text-center underline mt-1">{m.auth_logout_return_home()}</a>
      </div>
      <div class="font-mono text-[10.5px] text-ink-4 mt-4 text-center">
        {#if cancelled}
          {m.auth_logout_cancelled()}
        {:else}
          {m.auth_logout_auto_redirect()} · {m.auth_logout_press_esc()}
        {/if}
      </div>
    </PaperCard>
    <Margin rotate={1.5}>
      thanks for stopping by →<br/>
      <span class="text-[12px] text-ink-3">~ Maire (the librarian)</span>
    </Margin>
  </div>
</DeskSurface>
```

- [ ] **Step 2: Update `src/routes/auth/logout/page.spec.ts`** (the existing test only covered `performLogout`; that test still passes, but we add a new test for the page itself if appropriate. For now, keep the existing test as-is — the redesign doesn't change `performLogout` behavior.)

Run: `pnpm test:unit src/routes/auth/logout/page.spec.ts`
Expected: PASS (existing test unchanged).

- [ ] **Step 3: Run check + visual hand-verify**

Run: `pnpm check && pnpm dev`
Visit `http://localhost:5173/auth/logout`. Verify:
- Paper card on wood-grain desk, slight rotation (+0.4°)
- BrandMark top-left
- Green SIGNED OUT stamp (rotated -3°)
- "See you soon" Caveat heading (42px, centered)
- "Sign back in" featured ProviderButton + "Return to home" text link
- Auto-redirect countdown text (or "cancelled" if Esc pressed)
- "thanks for stopping by → ~ Maire" Caveat marginalia below

- [ ] **Step 4: Commit**

```bash
git add src/routes/auth/logout/+page.svelte
git commit -m "feat(library): /auth/logout redesign with 5s auto-redirect + Esc-to-cancel"
```

---

### Task 30: i18n key extraction

**Files:**
- Modify: `messages/en.json` (add new keys)
- Modify: `messages/et.json` (Estonian translations)
- Modify: `messages/lv.json` (Latvian translations)
- Modify: `messages/uk.json` (Ukrainian translations)

- [ ] **Step 1: Add the new keys to `messages/en.json`**

Add these keys to the existing JSON (preserve all current keys; do not remove anything):

```json
{
  "library_top_eyebrow": "Library · librarian's desk",
  "library_top_heading": "On the desk today",
  "library_rehearsal_in": "Rehearsal {time} · in {countdown}",
  "library_search_placeholder": "⌘K · jump to work, copy #, borrower…",
  "library_returns_title": "Returns",
  "library_returns_subtitle": "back from December",
  "library_returns_stamp": "ARRIVED",
  "library_returns_folder_label": "Folder · Bass section",
  "library_returns_counted": "{n} counted",
  "library_returns_ticked_label": "ticked",
  "library_returns_confirm": "Confirm {n} ✓",
  "library_overdue_title": "Overdue",
  "library_overdue_subtitle": "basses still hold these",
  "library_overdue_stamp": "OVERDUE",
  "library_overdue_marginalia": "owe rental library\nif not back by 31 May",
  "library_overdue_copies_out": "copies out",
  "library_overdue_nudge_both": "Nudge both ✉",
  "library_overdue_borrower_days": "{n} days overdue",
  "library_overdue_borrower_nudge": "Nudge",
  "library_overdue_borrower_return": "Return",
  "library_pull_title": "Pull for tonight",
  "library_pull_subtitle": "48 singers · stack on the desk",
  "library_pull_stamp": "TONIGHT",
  "library_pull_request_line": "Conductor's request · Tue {date} · 16:00",
  "library_pull_singers_tonight": "Singers tonight",
  "library_pull_to_pull": "to pull",
  "library_pull_pulled": "pulled",
  "library_pull_on_the_desk": "✓ on the desk",
  "library_pull_locate": "Locate",
  "library_pull_skip": "Skip",
  "library_pull_pull_n": "Pull {n} →",
  "library_pull_undo": "Undo",
  "library_catalog_works": "Catalog · {n} works",
  "library_catalog_owned": "{n} copies owned",
  "library_catalog_available": "{n} available",
  "library_catalog_on_loan": "{n} on loan",
  "library_catalog_overdue": "{n} overdue",
  "library_catalog_open_full": "Open full catalog ↗",
  "auth_login_eyebrow": "Sign in",
  "auth_login_heading": "Welcome back",
  "auth_login_subtitle": "Pick how you'd like to identify yourself.",
  "auth_login_last_used": "Last used",
  "auth_login_all_providers": "All providers",
  "auth_login_footnote": "New here? Sign in with the provider your choir's secretary registered for you. The first time signs you up automatically.",
  "auth_provider_smart_id": "Smart-ID",
  "auth_provider_smart_id_sub": "EE/LV/LT",
  "auth_provider_mobile_id": "Mobile-ID",
  "auth_provider_mobile_id_sub": "EE",
  "auth_provider_id_card": "ID-card",
  "auth_provider_id_card_sub": "EE",
  "auth_provider_google": "Continue with Google",
  "auth_provider_apple": "Apple",
  "auth_provider_email": "E-mail",
  "auth_provider_email_sub": "magic link",
  "auth_logout_stamp": "Signed out",
  "auth_logout_heading": "See you soon",
  "auth_logout_subtitle": "Your session has been cleared from this browser.",
  "auth_logout_sign_back_in": "Sign back in",
  "auth_logout_return_home": "Return to home",
  "auth_logout_auto_redirect": "auto-redirect in 5s",
  "auth_logout_press_esc": "press Esc to cancel",
  "auth_logout_cancelled": "redirect cancelled · click to navigate"
}
```

Note: replace `auth_login_heading` if it already exists (current value is the simple "Sign in" heading); the new value "Welcome back" is the redesigned copy.

- [ ] **Step 2: Add Estonian translations to `messages/et.json`** (same keys; translate values to Estonian). For brevity, replace any uncertain Estonian with the English value as a placeholder marked `TODO et:`; Comenius/PO can refine.

- [ ] **Step 3: Add Latvian translations to `messages/lv.json`** (same keys; translate or mark `TODO lv:`).

- [ ] **Step 4: Add Ukrainian translations to `messages/uk.json`** (same keys; translate or mark `TODO uk:`).

- [ ] **Step 5: Regenerate Paraglide bindings**

Run: `pnpm i18n:gen`
Expected: build runs; Paraglide regenerates `src/lib/paraglide/messages.js` with the new keys typed and accessible.

- [ ] **Step 6: Run full type check + test suite**

Run: `pnpm check && pnpm test:unit`
Expected: PASS — all `m.<key>()` references in the library page + auth pages resolve; no missing-message errors.

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/et.json messages/lv.json messages/uk.json
git commit -m "i18n(library): add keys for /library + redesigned /auth/login + /auth/logout"
```

---

### Task 31: Final verification + visual smoke

**Files:** none modified.

- [ ] **Step 1: Run full verification gate**

Run: `pnpm check && pnpm test:unit && pnpm lint && pnpm build`
Expected: 0 type errors, all unit tests pass, 0 lint errors, build clean.

- [ ] **Step 2: Run Playwright tests (note pre-existing failures from CHORE-C scope are allowed)**

Run: `pnpm test:e2e`
Expected: Pre-existing failures only (11 from session 17 baseline); no NEW failures introduced by this CHORE.

- [ ] **Step 3: Hand-verify on local dev server (the three pages)**

Run: `pnpm dev`
Visit each URL and confirm visually:
- `http://localhost:5173/library` — wood-grain desk, 3 stacks with stamps, ambient catalog strip below
- `http://localhost:5173/auth/login?picker=1` — paper card with provider buttons on desk
- `http://localhost:5173/auth/logout` — paper card with SIGNED OUT stamp, See you soon, auto-redirect countdown

- [ ] **Step 4: Push branch and open PR for Bentham review**

```bash
git push -u origin feat/library-page-ui-kit
gh pr create --title "feat(#60): /library page + UI kit + auth redesign" --body "$(cat <<'EOF'
## Summary

- Adds 21-component UI kit synthesized from the 2026-05-23 Claude Design librarian bundle
- Adds `/library` route composing the kit (wood-grain desk + 3 paper stacks + ambient catalog strip)
- Redesigns `/auth/login` and `/auth/logout` to use the same design system (paper card on desk surface)
- All CHORE-B auth logic preserved (storage, OAuth flow, callback, redirect timers)
- Mock fixtures match the polyphony seed Pérotin landed in the parallel workstream (commit `6d58544`)
- Live Entu wiring is a follow-up CHORE; the page reads from `$lib/fixtures/library-mock.ts` in this PR

## Spec
`docs/superpowers/specs/2026-05-23-library-page-ui-kit-design.md` (PO-approved, on main)

## Plan
`docs/superpowers/plans/2026-05-23-library-page-ui-kit.md`

## Closes
Closes #60

## Test plan

- [ ] `pnpm check` — 0 type errors
- [ ] `pnpm test:unit` — all unit tests pass (new component specs included)
- [ ] `pnpm lint` — 0 errors
- [ ] `pnpm build` — clean
- [ ] Visual hand-verify: `/library`, `/auth/login?picker=1`, `/auth/logout`
- [ ] Bentham review

mihkel.putrinsh@gmail.com
EOF
)"
```

Expected: branch pushed, PR opened, ready for Bentham review.

---

## Self-review notes (post-write)

**Spec coverage check:**
- §2 in-scope (21 components + /library + auth redesign + tokens + fonts + fixtures + i18n + tests) — all covered (Tasks 1-31).
- §4.1-4.6 page architecture — covered in Task 27 + Tasks 28-29.
- §5 component inventory (21 items) — each has a Task (5-25).
- §6 invariants — PaperStack stretch-to-fit asserted explicitly in Task 17 + PaperCard in Task 19.
- §7 tokens — covered in Task 2.
- §8 fonts — covered in Task 2 (same file, same task).
- §9 i18n — covered in Task 30.
- §10 mock fixtures + live-wiring boundary — Task 4 builds the fixtures; CHORE clearly stops at fixtures per the spec.
- §11 Pérotin parallel — already complete in main (no plan task needed).
- §12 implementation plan outline — this entire document.

**Type consistency:** Component prop names (`work`, `edition`, `pulled`, `needed`, `member`, `loans`, `tone`, `rotate`, `featured`, `signedIn`, `currentTab` etc.) used consistently across tasks. Voice type is `'S1' | 'S2' | 'A' | 'T1' | 'T2' | 'B1' | 'B2'` from Task 3, used in Voice/VoiceTally/BorrowerCard/MEMBERS.

**Placeholders:** Each test has concrete assertions; each impl has full code; no "implement later" or "TBD" markers.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-library-page-ui-kit.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit for the 31 tasks here: per-task review catches drift early, and the test-then-impl pattern is easy for a focused subagent.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints. Faster start, less per-task overhead, but bigger context per task.

**Which approach?**
