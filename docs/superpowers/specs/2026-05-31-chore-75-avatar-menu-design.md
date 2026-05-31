# CHORE-75 — Avatar dropdown user menu — Design Spec

**Date:** 2026-05-31
**Status:** spec ready for plan
**GH issue:** #75
**Predecessor:** CHORE-66 (MvoxNav + userStore) · CHORE-72 (paper-and-ink aesthetic) · CHORE-74 (state propagation — login auto-redirect works)

## Goal

Add a logout affordance to the UI. Today the `/auth/logout` route exists but is only reachable by typing the URL. PO surfaced the gap during CHORE-74 manual testing.

Implementation: turn the existing avatar tile in `MvoxNav.svelte` into a button that toggles a small paper-card drop-down menu. Menu lists "Signed in as {name}" + a "Sign out" item that navigates to `/auth/logout`. Pure Svelte 5; no headless menu library.

## Non-goals

- Switch-org from menu — already covered by `OrgPicker`
- Profile / settings menu entries — those routes don't exist yet (defer until they do)
- Theme picker, language picker — out of scope
- Mobile-specific touch handling beyond what `<button>` + `click` give us — acceptable on desktop & mobile both
- Headless menu library (e.g. `melt-ui`, `bits-ui`) — YAGNI for a single menu; revisit if a 3rd menu pattern lands

## Audience

Signed-in users (the menu only renders when `signedIn === true`). Curious bystanders see nothing — they're on the marketing page where MvoxNav shows the brand + "Sign in" link.

## Component contract

### `<AvatarMenu />`

**Props:**

```ts
type AvatarMenuProps = {
  name: string;      // user's display name from $userStore.name
  initial: string;   // single uppercase character for the avatar tile
};
```

**Behavior:**

- Renders an inline-flex container with the avatar `<button>` as its only child by default
- Avatar `<button>` shows the `initial` character; styled to match the existing avatar tile (30px square, ink-on-paper-3, semi-bold)
- Clicking the button toggles a panel `<div role="menu">` that drops absolute-positioned below + right-aligned to the button
- The panel renders:
  - Eyebrow line: `{m.nav_signed_in_as()}` (e.g. "Signed in as"), font-mono, ink-3, uppercase, tracking-wider
  - Name line: `{name}`, font-sans, ink, semi-bold
  - Thin ink-5 horizontal divider
  - "Sign out" item: an `<a href="/auth/logout">` with `role="menuitem"`, `text-ink hover:bg-paper-2`, showing the "Sign out" copy from `m.nav_sign_out()` plus a right-aligned `→` glyph
- Outside click closes the menu (window-level `mousedown` listener registered while open)
- `Escape` key while menu is open closes the menu + returns focus to the trigger button
- ARIA: button has `aria-haspopup="menu"`, `aria-expanded="true|false"`, `aria-label={m.nav_user_menu_aria()}`. Panel has `role="menu"`. Items have `role="menuitem"`.
- Focus management: opening the menu focuses the first menuitem (so keyboard users can immediately Enter to sign out); closing returns focus to the trigger.

**Implementation notes:**

- Use Svelte 5 runes: `let open = $state(false)`, `$effect(() => { if (open) addEventListener... ; return cleanup })` for outside-click + Esc
- Don't use a portal for the panel (overkill for a positioned dropdown that doesn't overflow the navbar)
- Stay vocabulary-neutral: component name `AvatarMenu` (not `MemberMenu`, not `ChoirAvatarMenu`)

### MvoxNav.svelte — modification

The current MvoxNav block in the signed-in branch renders:

```svelte
<span class="inline-flex items-center gap-1.5 font-sans text-[11.5px]">
  <span ... initial avatar tile ... />
  <span>{userName}</span>
</span>
```

Replace with:

```svelte
<AvatarMenu name={userName} initial={userInitial} />
```

The `<AvatarMenu>` component owns rendering the initial tile + name. (Note: the existing visual currently shows the name as inline text NEXT to the tile. The new design moves the name into the dropdown panel — the tile alone remains in the navbar to avoid widening it. Confirm during Bentham review whether to also keep the name visible inline outside the dropdown; default per spec is hide-name-in-navbar.)

## Copy (verbatim production English)

| Slot | i18n key | English |
|---|---|---|
| Eyebrow above name | `nav_signed_in_as` | `Signed in as` |
| Sign out item | `nav_sign_out` (existing) | `Sign out` |
| Trigger aria-label | `nav_user_menu_aria` | `User menu` |

## i18n keys

```jsonc
{
  "nav_signed_in_as": "Signed in as",
  "nav_user_menu_aria": "User menu"
}
```

Comenius adds et/lv/uk translations. Per the new vocabulary-neutrality rule, key names stay semantic (`nav_*`); translations use natural locale equivalents.

## Tests

### `src/lib/components/AvatarMenu.spec.ts` (new)

- Renders the trigger button with the initial character
- Trigger button has correct ARIA: `aria-haspopup="menu"`, `aria-expanded="false"` initially
- Click trigger → `aria-expanded="true"`, menu panel renders
- Menu panel shows the eyebrow + name + sign-out link
- Click trigger again → menu closes
- Esc key while open → menu closes
- Outside click → menu closes
- Sign-out link href is exactly `/auth/logout`

### `src/lib/components/MvoxNav.spec.ts` (extend)

- Existing avatar assertions adjusted to assert the trigger button shape
- Light: confirm `<AvatarMenu>` is rendered in the signed-in branch
- Behavior assertions unchanged

## Acceptance criteria (from #75)

1. AC1: Avatar trigger is keyboard-focusable; ARIA wiring correct
2. AC2: Click toggles menu open/closed
3. AC3: Esc closes menu (focus returns to trigger)
4. AC4: Outside click closes menu
5. AC5: Menu shows "Signed in as {name}"
6. AC6: Sign out link → `/auth/logout`
7. AC7: 3 i18n strings render; et/lv/uk wired by Comenius
8. AC8: Existing 555 tests still pass
9. AC9: New AvatarMenu unit specs cover trigger + Esc + outside-click + name + link
10. AC10: gates clean
11. AC11: Bentham review GREEN

## Files touched

| Status | File | Why |
|---|---|---|
| New | `src/lib/components/AvatarMenu.svelte` | The dropdown component |
| New | `src/lib/components/AvatarMenu.spec.ts` | Coverage |
| Modify | `src/lib/components/MvoxNav.svelte` | Replace inline avatar block with `<AvatarMenu>` |
| Modify | `src/lib/components/MvoxNav.spec.ts` | Adjust trigger-shape assertions |
| Modify | `messages/en.json` | +2 keys (`nav_signed_in_as`, `nav_user_menu_aria`) |
| Modify | `messages/et.json` / `lv.json` / `uk.json` | Translations |

**Total: ~6 files.** 1 new component + spec, 1 component edit + spec, 4 locale files.

## Schema impact

None.

## Architecture compliance

- **Vertical-skin neutrality** (arch-decisions 2026-05-31): component name + i18n keys + types all vocabulary-neutral. Copy carried only in i18n values.
- **URL-overrides-persisted** (arch-decisions session 22): N/A — no URL state introduced.
- **Per-commit-GREEN**: TDD chain commits maintain green gates.

## Open questions / deferred

- **Keep name inline in navbar AND in dropdown?** Spec defaults to hide-name-in-navbar (move-to-dropdown), so the trigger is just the avatar tile. Bentham may YELLOW if PO prefers name-stays-inline; trivial revert if so.
- **Switch-org from menu** — deferred (OrgPicker exists)
- **Profile/Settings entries** — deferred until those routes exist
- **Keyboard nav within menu** — only 1 item today; menuitem arrow keys not needed. Revisit when menu grows.

## Related

- CHORE-66 (`9266e2e`) — original userStore + MvoxNav + avatar block
- CHORE-72 (`29de0d2`) — paper-and-ink kit + marginalia conventions
- CHORE-74 (`cb3aec0`) — state propagation; login auto-redirect now works (this menu unlocks the test loop)
- `feedback_mvox_visual_personality` — lean character-rich
- `feedback_mvox_hybrid_aesthetic` — Inter load-bearing, Caveat marginalia-only

(*MVOX:Palestrina*)
