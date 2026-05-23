# /library page + UI kit synthesis — design spec

**Status:** approved (PO, 2026-05-23 session 19)
**CHORE:** GH #60 (CHORE-60)
**Brainstorm output:** synthesis of the 2026-05-23 Claude Design librarian bundle (`docs/design/inbox/2026-05-23-librarian/bundle/mvox.eu-handoff.zip`) into a Svelte 5 UI kit + a composed `/library` page.

(*MVOX:Palestrina*)

## 1. Summary

CHORE-60 converts the Claude Design bundle's librarian view into a real `/library` page on mvox, plus a small but durable UI kit of reusable Svelte components that will serve future pages (members workspace, conductor's view, roster, etc.).

The bundle shipped 3 directions (Catalog / Ledger / Desk). PO did not pick one wholesale; instead the synthesis is:

- **Page IA = Direction C ("The Working Desk")** — wood-grain background spans the entire `/library` page; 3 paper-stack cards sit on the desk for today's tasks; ambient catalog strip at the bottom links out to a future `/library/catalog` route.
- **Aesthetic = hybrid** — Inter is the load-bearing font (headings, data, controls, labels). Caveat is reserved for marginalia, handwritten notes, stack-card titles ("Returns" / "Overdue" / "Pull for tonight"), and other "this was written by a person" moments. JetBrains Mono for IDs, dates, and tabular numerics. Squiggly underlines + rotated stamps + paper-stack rotations are accent-tier — used where they earn their keep.
- **Selection criterion = visual distinctiveness over operational throughput** — when picking among variants, lean character-rich (PaperStack, stamps, Caveat marginalia) over efficient/generic.

## 2. Scope

### In scope (CHORE-60)

- `/library` Svelte route — full page composing the kit modules
- ~17 Svelte 5 components (the UI kit) listed in §5
- Tailwind v4 `@theme` token block (paper/ink/state palette)
- Font loading for Caveat, Inter, JetBrains Mono
- Mock data fixtures matching the bundle's `Data.jsx` shape (TypeScript const exports for dev/test)
- Component spec tests (Vitest, RED before GREEN per team TDD chain)
- i18n keys for the user-visible UI labels (en/et/lv/uk per stack)

### Out of scope (future CHOREs)

- `/library/catalog` — the full browsable holdings table with search, filters, sort, inspector right-rail (B-style Ledger from the bundle). Tracked as **CHORE-60.next** when the ambient strip's "Open full catalog ↗" link needs a destination.
- Lending workflow UI (new loan, return, write-off) beyond the in-stack action buttons — those buttons are present but routed as no-op handlers in CHORE-60.
- Real Entu wiring of the `/library` data path (the page renders against mock fixtures in CHORE-60; Path C browser-direct calls to api.entu.app land in a follow-up).
- The other bundle exploratory wireframes (Admin, Members workspace, Conductor C1-4, Notices N1-3, Roster, Voices V1-4, Schema diagrams, Sections) — those are reference material for future page CHOREs; not converted here.
- Non-librarian persona view of `/library` (a singer browsing the catalog) — scoped to librarian-only for CHORE-60 per §3.

### Explicit non-goals

- Pixel-perfect parity with the bundle's exact pixel measurements. Bundle is "pencil/paper exploration"; we recreate intent, not pixels.
- Sketch-quality everywhere (squiggles in headings, Caveat in data tables). The hybrid rule keeps load-bearing UI on Inter.
- Direction selection. We are NOT picking A vs B vs C as wholesale designs. We are synthesizing C (Desk) as the page IA with picked elements from the kit's primitives layer.

## 3. Persona scope

`/library` is **librarian-only** for CHORE-60. The page represents Maire's working surface — copy lending, returns, pull lists, overdue chase. Singers and conductors see a different (future) page at `/library`, possibly role-switched at the route level. Not designed in this CHORE.

## 4. Page architecture

### 4.1 Layout grid

```
┌─────────────────────────────────────────────────────────────────┐
│ MvoxNav   ·   mvox / EPCC · agenda · [library LIBRARIAN] · …   │  ← shared top nav
├─────────────────────────────────────────────────────────────────┤
│ Top strip                                                       │
│  Library · librarian's desk         Date · time · rehearsal countdown │
│  ON THE DESK TODAY (Caveat 30px)                    [search ⌘K]       │
├─────────────────────────────────────────────────────────────────┤
│ Wood-grain desk surface                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐         │
│  │ ┃ Returns   │  │ ┃ Overdue   │  │ ┃ Pull for tonight│         │
│  │   ARRIVED   │  │   OVERDUE   │  │   TONIGHT        │         │
│  │  [body]     │  │  [body]     │  │  [body]          │         │
│  └─────────────┘  └─────────────┘  └──────────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│ Catalog · 13 works · stats · …    Open full catalog ↗           │  ← ambient strip
│ [mini-card] [mini-card] [mini-card] [mini-card] [mini-card] [mini-card]
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 The three paper stacks (today's tasks)

All three stacks share:
- `PaperStack` wrapper — 3-sheet shadow via `::before` + `::after`, slight rotation per stack, **stretches to fit content** (the wrapper's box geometry is the source of truth; the pseudo-element shadow follows the wrapper's box via `inset: 0`).
- `StackHeader` — `Rank` (tonal circle: green/red/indigo) + Caveat title (short noun) + Inter sub + `Stamp` (rotated -3°).
- Internal divider (dashed) between header and body, and between body and footer.
- Footer row with Caveat big-tally on the left and action button(s) on the right.

Stack-specific bodies:

| Stack | Tone | Stamp | Body composition |
|---|---|---|---|
| **Returns** | green | `ARRIVED` | Work title + edition meta · Folder caption + Caveat "12 counted" · 6×2 grid of `CopyChip` (PencilCheckbox + #NN). Bottom: 8/12 Caveat tally + "Confirm 4 ✓" dark btn. |
| **Overdue** | red | `OVERDUE` | Work title + edition meta · vertical `BorrowerCard` per borrower (avatar initials + name + voice badge + Mono copy IDs + Caveat "195 days overdue" + per-card Nudge/Return btns). Caveat rotated marginalia ("owe rental library if not back by 31 May") absolute-positioned at top-right. Bottom: red Caveat tally + "Nudge both ✉" red-out btn. |
| **Pull for tonight** | indigo | `TONIGHT` | Per-work `PullItemCard` (PencilCheckbox + composer/title + right-aligned big-Caveat needed count). Done variant: green border + green tally + "✓ on the desk" + Undo. Todo variant: Locate / Skip / Pull-N. Bottom: VoiceTally footer strip showing expected singers (S1×8 S2×8 A×12 T×10 B×10). |

### 4.3 Top strip

- Eyebrow: `Library · librarian's desk` (uppercase 10px, ink3)
- Title: `On the desk today` (Caveat 30px, ink)
- Right: date + time (Inter 11px, JetBrains Mono for time), countdown to next rehearsal (Caveat 15px, red)
- Right-far: `PencilSearch` (280px, paper bg, 2px shadow, ⌘K hint)

### 4.4 Layout wrapping decision

The current `src/routes/+layout.svelte` applies a `max-w-5xl mx-auto` content wrapper around all pages. The desk surface wants edge-to-edge viewport width to read as a real desk. Two options for `/library`:

- **(a) Nested layout** — `src/routes/library/+layout.svelte` declares its own wrapper without the `max-w-5xl` constraint, while still rendering the global `MvoxNav` via parent layout slot composition. Cleanest separation; SvelteKit-idiomatic.
- **(b) Page-level escape** — `/library/+page.svelte` uses negative margins or absolute positioning to break out of the parent's wrapper. Hacky.

**Default: (a) nested layout.** Update `src/routes/+layout.svelte` to render its `max-w-5xl` wrapper conditionally (skip when child layout opts out), or restructure so the page-content wrapper lives in a child layout that `/library` overrides. Comenius's i18n integration (`m.nav_*()` calls in the global layout) stays intact.

### 4.5 Ambient catalog strip (bottom)

- Header row: `Catalog · 13 works` eyebrow on left + summary stats (X owned · Y available · Z on loan · W overdue) middle + `Open full catalog ↗` link right (routes to `/library/catalog`, which is the next CHORE).
- Body: 6-column grid of `MiniWorkCard` — first 6 works (pinned / recent / today's relevant). Each card: composer (bold, truncate) + title (italic, truncate) + voicing/stats row with state-tone count.
- Bg: `paper2` (one shade darker than the surrounding paper) to read as "the drawer under the desk."

## 5. Component inventory (the UI kit)

All components live in `src/lib/components/`. Tested via colocated `*.spec.ts` (RED → GREEN per chain). Typed props with Svelte 5 Runes (`$props()`, no `export let`).

| # | Component | Purpose | Used by |
|---|---|---|---|
| 1 | `MvoxNav` | Top app nav: brand + org chip + section tabs + user pill. `LIBRARIAN` role chip when current user is librarian and library tab active. **Replaces** the current `src/routes/+layout.svelte`'s simple Tailwind nav. Preserves the existing sign-in/out behavior (reads `getToken()` from `$lib/auth/storage`, watches `storage` events for cross-tab logout, gates UI on `mounted` to avoid FOIC). Preserves the existing Paraglide i18n integration (`m.nav_sign_in()` / `m.nav_sign_out()`). | `+layout.svelte` (global) |
| 2 | `PencilSearch` | Sketch-styled search input with shadow + key hint slot. | top strip; future catalog page |
| 3 | `KeyHint` | Single keyboard shortcut indicator (boxed mono char + label). | top strip; footer; future catalog |
| 4 | `DeskSurface` | Wood-grain background wrapper (repeating-linear + 2 radial overlays). Inner padding configurable. | `/library +page.svelte` |
| 5 | `PaperStack` | Slight-rotation + 3-sheet shadow wrapper. **Stretches to fit content** (invariant — see §6). Accepts `tone` prop to color the main border (default ink, `red` variant for overdue stack). Children: any. | each of the 3 task stacks; future stack-shaped widgets |
| 6 | `StackHeader` | Header row inside PaperStack: `Rank` + Caveat title + Inter sub + `Stamp` (positioned absolute top-right). Props: `rank`, `title`, `subtitle`, `tone` (green/red/indigo), `stamp`. | each task stack |
| 7 | `Rank` | Tonal circle with Caveat numeral. Props: `n`, `tone` (green/red/indigo/neutral). | `StackHeader`; future borrower-position numbering |
| 8 | `Stamp` | Rotated Caveat-or-Inter pill label (-3° default). Props: `label`, `tone`. | `StackHeader`; future doc-status moments |
| 9 | `Tally` | Caveat big numeral + Inter uppercase label. Props: `n`, `label`, `tone` (default ink, red). | each stack footer; future stat surfaces |
| 10 | `PencilCheckbox` | Hand-drawn-checkmark checkbox via SVG-in-CSS. Props: `checked`, `tone` (default ink, red variant). | `CopyChip`, `PullItemCard`; future task lists |
| 11 | `Voice` | Voice badge (S1/S2/A/T1/T2/B1/B2) with voice-specific bg color. Props: `v`. | `BorrowerCard`, `VoiceTally` |
| 12 | `VoiceTally` | Horizontal voice-counts strip (`S1 ×8 · S2 ×8 · A ×12 · …`). Props: `counts: Record<Voice, number>`. | Pull-stack footer |
| 13 | `WorkTitle` | "Composer — *Title*" with optional alt-title. Props: `composer`, `title`, `titleAlt?`, `size` (s/m/l/xl), `italic`. | every stack body; mini-card; future catalog row |
| 14 | `CopyChip` | Single copy cell in the Returns body (PencilCheckbox + Mono #NN, with strike when checked). Props: `n`, `checked`. | Returns stack body |
| 15 | `BorrowerCard` | Overdue-borrower card: avatar initials circle + name + voice badge + Mono copy IDs + Caveat overdue-days + Nudge/Return buttons. Props: `member`, `loans[]`. | Overdue stack body |
| 16 | `PullItemCard` | Per-work pull card: PencilCheckbox + WorkTitle + right big-tally + state-driven action set (Locate/Skip/Pull-N for todo; ✓-on-the-desk + Undo for done). Props: `work`, `edition`, `pulled`, `needed`. | Pull stack body |
| 17 | `MiniWorkCard` | Bottom-strip work card: composer + title + voicing + state-toned available/total fraction. Props: `work`, `pinnedTone?`. | ambient catalog strip |
| 18 | `Margin` | Caveat-cursive rotated marginalia block. Props: `rotate`, `color` (default red). | Overdue stack's "owe rental library" warning; future contextual notes |

Total: 18 components. (One above the 17 in the composition note — `Margin` was implicit there; explicit here.)

Plus support modules (no separate components):
- `$lib/types/library.ts` — TypeScript types for `Work`, `Edition`, `Copy`, `Loan`, `Member`, `Choir`, `Task` matching v4E entity shapes (slimmed for the page's needs).
- `$lib/fixtures/library-mock.ts` — Mock data exports (the bundle's Data.jsx content, ported to typed TS).
- `$lib/library/derive.ts` — Pure helpers (`libStats`, `workStats`, `byMemberId`, etc. mirroring bundle's helpers).

## 6. Component invariants worth pinning

- **PaperStack stretches to fit content.** The wrapper is `display: flex` with `flex-direction: column`; pseudo-element shadows use `position: absolute; inset: 0` so they follow the wrapper's box automatically. No hard min-height or max-height in the primitive. Consumers may set both via inline style if needed for layout. This is the constraint PO surfaced when picking C for cat-2.
- **Caveat is accent-tier, not load-bearing.** Use Caveat for stack-card titles (short nouns), Margin notes, big-Tally numerals, and stack-stamp labels (optional, can use Inter). Never for data tables, action buttons, accessibility-critical text, or anything truncatable.
- **Voice badge colors are semantic.** S = peach, A = warm orange, T = warm green, B = cool blue. Used consistently in BorrowerCard, VoiceTally, and any future singer-list surface.
- **Stamp rotation is -3° not 0°.** The slight rotation is what makes it read as a stamped impression rather than a badge. Don't normalize away.
- **Wood-grain has 110° angle, not 0°.** The diagonal grain is the desk metaphor; horizontal stripes would read as ruled paper instead.

## 7. Tokens (Tailwind v4 `@theme`)

Add to `src/app.css`:

```css
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

Per the "no dynamic class names" common pitfall: every tone variant of a component uses a full Tailwind class name in its source, not a template literal.

## 8. Fonts

Add to `src/app.css` `@import` or self-host under `static/fonts/`:

```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

(Decision deferred to implementation: hosted via Google Fonts at first; switch to self-hosted under `static/fonts/` if CF cache TTL or privacy considerations push us. Issue spawn time of ~120ms for the 3 families is acceptable for first ship.)

## 9. i18n

Mark every user-visible string for Paraglide:

- Stack titles ("Returns", "Overdue", "Pull for tonight")
- Stamps ("ARRIVED", "OVERDUE", "TONIGHT")
- Stack sub-labels ("back from December", "basses still hold these", "48 singers · stack on the desk")
- Action buttons ("Confirm 4 ✓", "Nudge", "Return", "Locate", "Skip", "Pull 48 →", "Undo", "Nudge both ✉")
- Counter labels ("ticked", "copies out", "to pull", "pulled")
- Empty/derived strings ("Singers tonight", "Catalog · 13 works", "Open full catalog ↗")
- Top strip ("Library · librarian's desk", "On the desk today", "Rehearsal 16:00 · in 1h 28m")
- Marginalia ("owe rental library if not back by 31 May")

en/et/lv/uk per locale. Note: "Caveat" handwriting font may render Estonian/Latvian/Ukrainian diacritics imperfectly; Comenius to verify per locale at i18n step.

## 10. Data wiring

CHORE-60 renders against **mock fixtures** at `src/lib/fixtures/library-mock.ts`. Real Entu data wiring (via Path C browser-direct from CHORE-B) lands in a follow-up CHORE once the mock-shaped page is verified end-to-end.

Mock fixtures match the bundle's `Data.jsx` content verbatim (EPCC choir, 8 Estonian members, 13 works, 3 pinned tasks) but typed as TS exports against `$lib/types/library.ts`. The page reads from `$lib/fixtures/library-mock.ts` directly in CHORE-60.

The parallel Pérotin workstream (§11) materializes these fixtures as real v4E entities in the polyphony Entu db. When that lands, a follow-up CHORE swaps the page's import from fixtures to live `EntuClient` calls. The component contracts (types) don't change.

## 11. Parallel workstream — Pérotin seed into polyphony

Pérotin's brief (dispatched separately, this session):

- Map the bundle's `Data.jsx` content to v4E entities (`person`, `organization`, `library`, `work`, `edition`, `copy`, `lending`, plus any current-shape variants per `entu/research/docs/schema/v4E/schema.ts`).
- Polyphony is the target — **playground, not live** (per [[polyphony-is-playground]]).
- First deliverable: a strategy doc at `docs/migration/findings/2026-05-23-librarian-seed-strategy.md` covering: which existing polyphony entities to reuse (Pärt, Tallis, Byrd may already be present as works) vs create new; how copies + lendings get represented (current schema vs the bundle's loan shape); idempotency strategy (re-runnable + teardown); namespace plan if any.
- Second deliverable: an idempotent seed script at `scripts/migrations/seed-librarian-bundle-data.ts` + a dry-run + a single live execution against polyphony (gated by `"I authorize this run"` SendMessage from team-lead).
- The seed populates polyphony with the **same content** the mock fixtures (`$lib/fixtures/library-mock.ts`) carry, so the live-Entu wiring follow-up CHORE swaps the page's data source without changing the page's rendered output. Pérotin's strategy doc should explicitly map each mock-fixture record (the 8 members, 13 works, editions/copies/loans) to its target v4E entity instance plan.

Pérotin parallel-runs alongside the spec → implementation cycle for the page itself; the two streams meet when the page's data layer needs to swap from mock fixtures to live Entu calls.

## 12. Implementation plan (handoff to writing-plans)

The writing-plans skill takes this spec and produces a tasked plan. Sketched outline:

1. **Token + font setup** — Tailwind v4 `@theme` block; font @import; verify `pnpm dev` renders Caveat/Inter/Mono.
2. **Type + fixture scaffolding** — `$lib/types/library.ts`, `$lib/fixtures/library-mock.ts`, `$lib/library/derive.ts`. RED tests for the derive helpers (libStats/workStats), GREEN, lint.
3. **Primitive components, atomic** (T-RED → B-GREEN per chain): `Voice`, `PencilCheckbox`, `Rank`, `Stamp`, `Tally`, `WorkTitle`, `Margin`, `KeyHint`. Each colocated `*.spec.ts`.
4. **Composite components**: `VoiceTally`, `CopyChip`, `PencilSearch`. T-RED → B-GREEN.
5. **Stack scaffolding**: `PaperStack`, `StackHeader`. T-RED for stretch invariant + slot rendering; B-GREEN. Snapshot one full mounted stack with header + body slot.
6. **Stack bodies** as components: `BorrowerCard`, `PullItemCard`, `MiniWorkCard`. T-RED → B-GREEN.
7. **Page chrome**: `MvoxNav` (or update existing if already present), `DeskSurface`. T-RED → B-GREEN.
8. **`/library +page.svelte` composition** — wire the kit together, render mock fixtures, hand-verify against the approved composition mockup at `.superpowers/brainstorm/.../08-composition.html`. T-RED for the route loads + smoke-renders without crashing; B-GREEN.
9. **i18n keys** — Comenius pass: extract all user-visible strings to `messages/en.json` + propagate to et/lv/uk.
10. **Bentham review** — full architectural review of the kit + page composition. Verdict.
11. **Josquin merge** — squash-merge to main, deploy preview, hand-verify on the deployed URL.

Estimated: similar scale to CHORE-B (~15-17 tasks; mostly atomic components). Tallis-heavy at the test-writing stages; Byrd-heavy at GREEN; minimal Josquin (no backend changes since fixtures are in-source).

## 13. References

- Bundle: `docs/design/inbox/2026-05-23-librarian/bundle/mvox.eu-handoff.zip` (uploaded `1db5ac2`)
- Bundle README: `docs/design/inbox/2026-05-23-librarian/README.md`
- Source design prompt: `docs/superpowers/specs/2026-05-23-claude-design-librarian-prompt.md`
- v4E schema: `~/projects/entu-research/docs/schema/v4E/schema.ts`
- Path C data layer (now in production): `feat(#53): CHORE-B -- Path C rewrite (commit fc99291)`
- Architecture decisions: `teams/mvox-dev/memory/architecture-decisions.md` (Section "Data path — browser-direct to Entu (CHORE-53/Path C)" — the page's eventual data source)
- Composition mockup (reference for visual verification): `.superpowers/brainstorm/<session>/content/08-composition.html` (also embedded inline in this session's transcript)
- Memory anchors:
  - [[mvox-visual-personality-over-throughput]] — distinctiveness over throughput as the picking criterion
  - [[mvox-hybrid-aesthetic]] — Inter base + Caveat accents, no Caveat in data/controls
  - [[polyphony-is-playground]] — polyphony is dev sandbox; Pérotin's seed work targets it directly
  - [[feedback_authorization_gate]] — live-mutation gate preserved as ceremony even on playground

## 14. Open questions deferred to implementation

These are flagged for the implementation phase (writing-plans + Byrd) rather than blocking spec approval:

- **Font hosting decision** — Google Fonts CDN @import (simple, ~120ms initial render) vs self-host under `static/fonts/` (one less external dep; aligns with CF caching). Default: hosted at first; switch if needed.
- **Stack rotation values** — currently -0.8° / +0.6° / -0.3° per the bundle. Could be randomized within a small range per render to feel even more hand-dropped, but adds complexity. Default: hard-coded per the bundle.
- **Action button handlers** — the in-stack buttons (Nudge / Return / Confirm / Pull / etc.) need handler stubs. CHORE-60 routes them to `console.log` or no-op with a TODO marker; real handlers ship with the live-Entu wiring CHORE.
- **Future `/library/catalog` shape** — the bottom strip's "Open full catalog ↗" link points somewhere. CHORE-60 routes to `/library/catalog` which 404s until the next CHORE; alternative is to disable the link for now. Default: routes (so it's discoverable as a future feature), 404 acceptable.
- **Composition-mockup persistence** — the visual reference for the assembled page lives at `.superpowers/brainstorm/<session>/content/08-composition.html`, which is gitignored. Pre-merge of CHORE-60, copy that HTML (or a rendered screenshot) into `docs/design/inbox/2026-05-23-librarian/handoff-verification.html` so the reference survives the brainstorm session cleanup.
