# /about — Carus Outreach & Singer-Publisher Trust — Design Spec

**Date:** 2026-06-14 (brainstormed S35, implementation targeted S36) · **Author:** (*MVOX:Palestrina*)
**Status:** Design approved (PO, 2026-06-14). Awaiting spec review → writing-plans (S36).
**Related:** memory `project_mvox_carus_publisher_outreach`, `project_mvox_federation_publisher_mediation`. Current route: `src/routes/about/+page.svelte` (scaffold present, three Lorem-ipsum bodies).

## Purpose

Rewrite the `/about` page so that, in addition to serving choirs (its current audience), it works as a public **proof of devotion to healing the singer↔publisher relationship** — the page the PO points **Carus-Verlag** (and, in time, Estonian publisher Sven Peterson / SP Muusika) to. Context: the PO, acting for ESL (Eesti Segakooride Liit), addressed a real Tormis/Carus licensing infringement openly and is mending a strained relationship; mvox is the rights-respecting infrastructure that makes that mending structural. (Background lives in the PO's mailbox; the brilliant KNB has nothing on this story yet — populating it is a separate future item.)

## Goals / success criteria

- A Carus editor landing on `/about` comes away feeling **"these people respect us."** (Primary emotional outcome — trust rebuilding.)
- The page **defines a baseline Carus can comment on and co-work with**, expressed as **a concrete partnership offer**.
- The offer's centerpiece is **honest-path-by-default tooling**: mvox makes the legitimate path the easiest path, so respecting rights stops being an act of heroism and publishers spend less policing infringement.
- The page still serves choirs (its product users) — one page, woven, not bolted-on.
- Respect is **shown, not claimed**: ownership and restraint, no marketing bombast.

## Positioning spine & voice

One honest page, two readers. A choir sees its tool and its values; a publisher sees a choral world building infrastructure to make respecting rights effortless — an open invitation to partner.

**Voice:** sincere, plain, confident, warm — the existing "quiet infrastructure" register. Credibility from candor + restraint. Inter for body; the existing Caveat marginalia for the one handwritten human touch (per `feedback_mvox_hybrid_aesthetic`).

## Structure (woven; baseline crystallizes in "What We Believe")

Keeps the existing scaffold (intro + Our Mission / Our Story / What We Believe + marginalia). Draft copy below is the intended direction — Comenius owns final wording across locales; Byrd wires the keys.

**1. Intro — keep, widen the lens by one line.** Current "back-of-house / quiet infrastructure" stays, then add:
> "A choir sits inside a larger circle — singers, conductors, composers, and the publishers who carry their work into the world. mvox is built for that whole circle."

**2. Our Mission — the honest-path thesis.**
> "Most music isn't copied out of disrespect. It's copied because, in the minutes before a rehearsal, the honest path is the hard one and the shortcut is right there. mvox exists to flip that — to make finding, holding, licensing, and sharing choral music simpler than not, so honouring the people who wrote and published it becomes the natural default."

**3. Our Story — own a real misstep, no names** (the devotional core).
> "We didn't start as a software company. We started as singers and organisers inside Estonia's choral world — and we've been on the wrong side of the line ourselves. We've shared scores when we shouldn't have, and learned, sometimes uncomfortably, what that costs the people whose living is the music. That discomfort is why mvox exists. We're not building it to defend a position; we're building it so that respecting a composer's and a publisher's work is the natural default, not an act of heroism."

*(Candor in tone; NO public naming of Carus / Tormis / any partner. The specific, personal acknowledgment lives in the PO's direct correspondence.)*

**4. What We Believe — the crystallized baseline** (the addressable block + partnership offer). Heading kept. A few belief lines resolving into a humble, explicit offer:
> "Every copy should be accounted for. Licensing should be easy enough that no one is tempted to skip it. A publisher should see their work respected — not wonder where it went."
>
> "To publishers: mvox is being built to be the easiest place for choirs to do right by you. We'd rather design that **with** you than for you. This is our opening position — tell us where it's wrong, and help us define what 'honest by default' should mean."

**5. Contact line** (makes "comment and co-work" actionable):
> Publishers and rights-holders: write to **mihkel.putrinsh@gmail.com**.

**Marginalia (kept):** "~ the mvox team" (Caveat).

## i18n

- Locales: **en / et / lv / uk** (existing set). **No German** — Carus reads the English version (PO decision 2026-06-14).
- Replace the three placeholder bodies (`about_mission_body`, `about_story_body`, `about_values_body`) with real copy; add keys for the intro lens-line, the publisher offer, and the contact line. Keep flat key naming + 4-locale sync (Comenius).
- Estonian (`et`) matters most for the choral audience; en is the canonical + the publisher-facing version.

## Technical / scope

- **Content-led change.** Minimal/no new components; stays within `DeskSurface`/`PaperCard` aesthetic.
- **bg-rule conformance** (S33 invariant): all new text on a colored background except marginalia/big-titles tagged `data-desk-text`. `/about` is a public route → inside the Playwright bg-rule gate (`tests/bg-rule.spec.ts`); the rewrite must keep it green. The "What We Believe" baseline block may get a subtle visual lift (still bg-conformant).
- **TDD chain (S36):** Tallis (keys render / page structure / bg-rule) → Byrd (content + any layout) → Comenius (et/lv/uk) → Bentham (review incl. tone + bg-rule) → Josquin merge. Likely a light chain — mostly copy + i18n.
- No v4E schema involvement.

## Out of scope / future

- **German (`de`) locale** — deferred; Carus gets English. Revisit if outreach widens.
- **Populating the brilliant KNB** with the Carus/Peterson story — separate task; mailbox is currently the sole source.
- **A dedicated /publishers page** — rejected for now (the About page carries it, per PO).
- Specific licensing/marketplace mechanics — the offer is the *intended model* as a baseline for Carus to shape, not a built feature; the library/lending/licensing subsystem is separate, designed-not-built work.

## Open items for S36 kickoff

- Confirm whether the contact line uses a `mailto:` link vs plain text.
- Read the full Carus/Tormis mail thread (`19e3f59f52444354`, ~551KB — via subagent + jq) + the "isiklik" letter to Sven for tone calibration before finalizing copy.
