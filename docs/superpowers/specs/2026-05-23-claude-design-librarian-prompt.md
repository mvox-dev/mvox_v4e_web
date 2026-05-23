# Claude Design — Session 1 prompt: mvox librarian view

**Purpose:** A paste-ready prompt for one Claude Design session at https://claude.ai/design/. Designs a librarian view of mvox's score library — the component-extraction vehicle the team agreed on (2026-05-23, session 18 brainstorm).

**How to use this file:**
1. Copy the prompt block below (everything between the `---PROMPT-START---` and `---PROMPT-END---` markers).
2. Open https://claude.ai/design/ and start a new session.
3. Paste. Claude Design will generate 3 variants.
4. React in the canvas — keep, iterate, or re-prompt.
5. When a direction lands, use the "Send to Claude Code" handoff. The bundle returns to mvox-dev as `tokens.json` + extracted component HTML + `guidelines.md`. Byrd-via-Claude-Code converts to Svelte in a separate session.

**Style:** Story-driven, light brief (Approach 3). Pins persona + scenario + content; leaves visual direction open. Claude Design's 3 variants explore different feels.

---

---PROMPT-START---

Design a librarian view for **mvox**, a choral music sharing platform for choirs in Estonia, Latvia, Ukraine, and the broader Baltic / diaspora region.

## The scene

It's Tuesday afternoon at the Estonian Philharmonic Chamber Choir's rehearsal hall in Tallinn. Maire, the choir's librarian for the past twelve years, has ninety minutes before the singers arrive. She opens mvox on her laptop in the office off the rehearsal room.

She has three things on her mind, in this order:

1. **Mark twelve Tallis scores returned.** The basses brought back the *Spem in alium* parts from December's concert in a battered manila folder; she counted them this morning. Twelve copies. She needs to clear those from the open-loans list.

2. **Chase the Pärt copies that didn't come back.** The choir owes the rental library for four copies of Arvo Pärt's *Magnificat* still out with two basses since November. She wants to see who has them, when they were checked out, and decide whether to nudge or write them off.

3. **Pull three new pieces for tonight.** The conductor wants to try Veljo Tormis's *Raua needmine*, Cyrillus Kreek's *Õnnis on inimene*, and Eriks Ešenvalds's *Stars*. She needs to find each work in the library, check which edition the choir owns, see if there are enough copies for tonight's 48-singer rehearsal, and pull what's available to the desk before warm-up.

Maire is expert. She's done this for twelve years. The page should not hand-hold her — it should put the right tools within reach and stay out of her way.

## What the page is for

The librarian's working surface. Discover and act on works (compositions), editions (specific arrangements), copies (the physical or digital instances the choir owns), and lending records (who borrowed what, when it's due, when it came back).

Most of her actions are micro-actions performed many times: check, mark, search, count. The design should make the common path fast. The page is dense by purpose, not by accident.

## Content to populate the design with

Use real composer and work names. These are public-domain or widely-recorded choral repertoire and feel authentic to the Baltic context:

- Thomas Tallis — *Spem in alium* (40-voice motet, 1570s)
- Arvo Pärt — *Magnificat* (1989); *The Beatitudes* (1990)
- Veljo Tormis — *Raua needmine* / *Curse upon Iron* (1972)
- Cyrillus Kreek — *Õnnis on inimene* / *Blessed is the man*
- Eriks Ešenvalds — *Stars* (2011); *Only in Sleep*
- William Byrd — *Ave verum corpus*; *Mass for Five Voices*
- Hildegard von Bingen — *O Pastor Animarum*
- Eric Whitacre — *Sleep* (2000)
- Knut Nystedt — *Immortal Bach* (1988)
- Morten Lauridsen — *O Magnum Mysterium*

Editions: works often exist in multiple arrangements. *Magnificat* (Pärt) has at least three published editions; *Spem in alium* has the 40-part original plus various reduced-voice editions; *Raua needmine* has the original SATB plus shaman-drum-accompanied versions. Edition rows under a work row should be distinguishable (arranger, voicing — e.g., "SATB", "SSAATTBB" — language, publisher).

Members (for lending records). Use synthetic Estonian names — these are not real individuals:

- Maris Tamm, Soprano 1
- Henn Kuusik, Bass 2
- Ave Lepp, Alto
- Toomas Mägi, Tenor 1
- Liina Saar, Soprano 2
- Margus Roos, Bass 1
- Kärt Põld, Alto
- Andres Vahar, Tenor 2

Lending statuses needed in the design: **available**, **on loan**, **overdue**, **returned today** (recent confirmation that fades), and aggregate counts like "8 of 12 available" for works the choir owns in quantity.

## Information density and voice

This is the working tool of an expert. Don't make it sparse and friendly the way an onboarding app would. Don't make it dashboard-cold the way an enterprise admin tool would. Maire reads music; she reads scores; she reads catalogs. The page can be dense and trust the reader — typography first, ornament second.

mvox respects the choral tradition without being precious about it. Pärt and Tallis sit on the same shelf. The design can hold that.

## Constraints that hold

- **Languages.** The interface is multilingual (Estonian, Latvian, Ukrainian, English). Compose example labels in English, but composer and work titles stay in their original language (*Mu isamaa on minu arm* doesn't become "My fatherland is my love"). Diacritics matter: õäöüõ for Estonian, čšž for Latvian, єіїґ for Ukrainian. Type pairing must hold across these.
- **Light and dark.** The design should support both. The librarian sometimes works in a sunlit office, sometimes in a windowless storage room before evening rehearsal.
- **Mobile-aware, not mobile-first.** Maire uses her laptop for this. But she may pull it up on her phone in the score room to double-check a copy count. The design need not collapse gracefully to 360px width, but a touch-friendly version of the most-used actions should exist.
- **Accessible.** WCAG AA. Many choral conductors and librarians are older; type sizing and contrast matter.
- **Loading and empty states matter.** This page hits the network for everything (the platform fetches data directly from the backend, no proxy). Loading, empty, and error states should be designed, not afterthoughts.

## What this prompt does NOT specify

- The mood — editorial, institutional, utility, distinctive, something else. Surface three different directions across the three variants.
- The information architecture — tabs, drawers, list-vs-grid, search-first vs filter-first. Solve for Maire's three tasks; the layout that supports them is yours to invent.
- The component vocabulary — extract whatever the page needs. The handoff bundle (`tokens.json`, component HTML, `guidelines.md`) is the main payload we'll work from after this session.

## What we'll do with the output

We'll pick one variant, iterate within it, and then send the bundle to Claude Code, which will convert the components and tokens into Svelte 5 + Tailwind v4 source for the mvox repository. So the cleaner the `tokens.json` and the more semantic the component HTML, the better the conversion. We'll care about the `guidelines.md` for the team's design language; please be specific about type, spacing, color roles, and component-state rules.

Show me three directions.

---PROMPT-END---

---

## Notes for the team-lead (post-prompt)

**Estimated Claude Design token burn for this session:** moderate. Per session-17 Finn research, Lenny's Newsletter host paid $200 extra in one Opus 4.7 canvas iteration session. This prompt is single-shot + 3 variants; iteration is the budget question. Budget: pick a variant within 3-4 iterations of the initial output, or cut losses and re-prompt fresh.

**Privacy boundary:** all member names above are synthetic Estonian names. No real individuals are referenced. Per [[project_polyphony_email_trust]] + Pérotin's privacy-boundary register, this is the canonical mvox-dev synthesis pattern.

**Schema fidelity:** the work / edition / copy / lending model in the prompt matches the v4E schema as documented in [[project_polyphony_library_subtree]] (2026-05-17 schema review). If Claude Design renders something that violates this model (e.g., conflates work and edition, or treats lending as a property of work rather than copy), that's a signal to clarify in the next iteration, not a design defect of Claude Design.

**Handoff workflow** (per session-17 Finn research):
1. Claude Design's "Send to Claude Code" produces an HTML/CSS + `tokens.json` + `guidelines.md` bundle.
2. In a separate Claude Code session (Byrd, on a feature branch), the bundle is converted to Svelte 5 + Tailwind v4 source under `src/lib/components/` and `src/routes/library/`.
3. Tallis writes RED tests in parallel against the converted components.
4. Comenius adds i18n keys (Estonian content in the prompt stays; English UI labels become Paraglide keys).
5. Bentham reviews. Normal TDD chain.

**Next:** PO runs the Claude Design session out-of-band. When the bundle returns, file CHORE-LIB-DESIGN-IMPL as a follow-up issue and dispatch Byrd via writing-plans.

(*MVOX:Palestrina*)
