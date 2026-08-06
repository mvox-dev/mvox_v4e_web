# Can a non-owner member natively invite + produce a member? — settled against source (2026-08-06)

(*MVOX:Perotin*)

Onboarding "who can invite" gate (Mihkel ruled INVITED). Question: can a member who does NOT
hold org-`_owner` rights (a) natively CREATE an `invitation`, and (b) have the resulting `member`
come into existence, without owner-tier elevation at acceptance? Settled against the v4E schema
(`~/projects/entu-research/docs/schema/v4E/schema.ts`) and entu-api source
(`~/projects/entu-api`) — not reasoned, verified.

**Bottom line up front: the question as posed has a false premise.** There is no Entu-native
owner-tier gate on invitation/member creation at all — for either party. The `creators` rules in
schema.ts are a design-documentation convention with **zero enforcement in entu-api**. Read on for
the full trace; this reframes "owners-only vs any-member" into a bigger question the team needs to
resolve regardless of which policy is chosen.

## Q1 — `invitation` type: creators, `_parent`, and what a create actually requires

`schema.ts:544-583`:

```ts
const invitation: EntityDef = {
	name: 'invitation',
	blurb: "Org's consent. Admin creates; user accepts → member created + invitation deleted.",
	sharing: 'private',
	parents: [{ entity: 'organization', required: true, parentCard: '1', ... }],
	properties: [ email, sections, token, expires_at, inviter (system), message ],
	creators: [{ kind: 'parent_right', right: '_owner' }],
	notes: [
		'Bilateral consent: when matching `application` exists, BFF creates the member and deletes both this invitation and the application.',
		'Private by default — invite tokens should not be browsable.'
	]
};
```

Design intent is unambiguous: `creators: [{kind:'parent_right', right:'_owner'}]` says only a
holder of `_owner` on the target organization should create an `invitation`.

**But entu-api does not enforce this.** Traced the actual create path:

- `routes/[db]/entity/index.post.js:96-108` — the ONLY gate on `POST /entity` is
  `if (!entu.user) throw 403 'No user'`. That's it. No inspection of `_parent`, no rights check
  against the referenced parent entity.
- `utils/entity.js` `setEntity()` calls `checkEntityAccess(entu, entityId, properties, rightTypes)`
  (L42) — but `checkEntityAccess` (L83-118) opens with `if (!entityId) return` (L84-85). For a
  brand-new entity, `entityId` is `undefined` (passed from the route as `setEntity(entu, undefined, body)`,
  L104) — so the entire rights-check function is a no-op on create. The `_owner`-gate I found in
  the profile-visibility probe (L113-118) only applies to writes on an EXISTING entity.
- `inheritParentProperties()` (L297-326) reads the parent's `_sharing`/`_inheritrights` via a
  **direct MongoDB query** (`entu.db.collection('entity').find(...)`) — bypasses any
  application-level read-rights filtering entirely. It doesn't check whether the caller can even
  see the parent, let alone whether they hold `_owner`/`_editor` on it.

**Conclusion: a plain member (or, for that matter, any authenticated Entu user in the db at all)
can POST an `invitation` entity with any org as `_parent`, holding no rights on that org
whatsoever.** `creators: parent_right(_owner)` is aspirational, not enforced.

## Q2 — `member` type: creators, `_parent`, and who can create it at acceptance

`schema.ts:287-333`:

```ts
const member: EntityDef = {
	name: 'member',
	blurb: 'Per-org membership record. Admin-controlled; all self-edit moved to person.',
	sharing: 'private',
	parents: [
		{ entity: 'organization', required: true, parentCard: '1', ... },
		{ entity: 'section', required: false, ... }
	],
	properties: [ person (ref), current_section (ref), status ],
	creators: [{ kind: 'bilateral', requires: ['invitation', 'application'] }],
	notes: [ 'Type-level `_sharing: public`; instance default `private`...' ]
};
```

`bilateral` isn't one of Entu's native right kinds (`_owner`/`_editor`/`_expander`/`_viewer`) —
it's a v4E-invented `CreatorRule` (`schema.ts:37-43`) meaning "requires a matching pair of
`invitation` + `application` to exist." Entu has **no concept of `bilateral` at all** — it's pure
schema documentation. The README confirms the intended enforcer explicitly, repeatedly:

- `README.md:701-702`: "BFF atomic operation" — the member-creation step at acceptance.
- `README.md:585` (schema.ts invitation notes) / `README.md:628` (application notes): "BFF creates
  the member and deletes both."
- `README.md:544-546` ("BFF user-rights principle"): "BFF acts in the authenticated user's rights
  by default... Any frontend (polyphony app, Entu UI, custom client) can do everything the user is
  entitled to via rights — BFF has no magic capabilities beyond that."

That last line is the crux: the schema's OWN stated principle is that a BFF should only ever act
within the calling user's existing Entu rights — implying bilateral-consent member-creation was
ALWAYS meant to run as a genuinely-privileged, explicitly-marked server operation (not "the user's
own rights"), since neither the inviter alone nor the invitee alone naturally holds the right to
write a `member` entity under the org via native Entu rights. **mvox has no BFF — no server
process exists to be that enforcement point.**

Same trace as Q1 applies directly: `POST /entity` for a `member` requires only `entu.user`
existing. Nothing checks for a matching `invitation`+`application` pair, nothing checks `_owner`
on the org. **Any authenticated user can POST a `member` entity under any organization's `_parent`
right now, with no invitation, no application, and no rights on that org at all.**

## Q3 — VERDICT

**Reframing the question, because the premise doesn't hold:** it isn't "owner-tier by
construction, forcing who-can-invite to owners-only" vs. "any-member natively achievable." **Ownership-tier
enforcement doesn't exist in this architecture for EITHER path.** Entu enforces `_owner`/`_editor`
gates only on writes to entities that **already exist** (`checkEntityAccess`'s L113-118 gate,
confirmed in the prior profile-visibility probe) — creation of new entities is gated by nothing
beyond "is there a logged-in Entu user." The v4E schema's `creators` rules
(`parent_right`/`self`/`bilateral`/`custom`) describe the INTENDED policy; they are enforced
entirely by application code, and the schema's own README repeatedly names that enforcer as "BFF"
— which mvox does not have and, per the earlier profile-visibility probe (Entu JWT `aud` is
IP-bound at mint), structurally cannot have in the conventional sense.

So: **"any member invites end-to-end" is not blocked by Entu today — but neither is
"owners-only," nor is bilateral consent itself, nor (more broadly) is almost every `creators` rule
in the v4E schema.** Choosing "any member invites" doesn't unlock a feature that was otherwise
gated; it's choosing a POLICY in a system that currently enforces NONE of these policies natively.
The real question the team needs to resolve isn't "who is allowed to invite" — it's **"how does
any `creators` rule in this schema get enforced at all, given there's no BFF and Entu doesn't check
`_parent` rights on create."** This is the same structural gap the profile-visibility probe
surfaced (no server-side enforcement point exists in this architecture) applied to a second,
independent area of the schema.

This is a scope-defining finding, not a narrow yes/no — flagging for Mihkel/Gama rather than
picking a direction. Options as I see them (not recommending one — this is a bigger architecture
call than my remit):

- Accept that `creators` rules are currently unenforceable and unenforced for ALL entity types
  that need cross-party or elevated creation (invitation, member, and likely others sharing the
  `parent_right`/`bilateral` pattern) — ship "any authenticated user can create anything" as the
  honest current state, and decide whether that's acceptable for a private-beta/synthetic-data
  phase.
- Build SOME server-side enforcement point (a real BFF, even a minimal one, contradicting the
  current browser-direct decision) scoped specifically to these elevated-creation operations.
- Investigate whether Entu itself has an extension point (a plugin/webhook hook, a
  `systemUser`-gated route) that could validate `creators` rules without a general-purpose BFF —
  not investigated in this probe; would need its own pass.

Not implementing or recommending a fix — this is exactly a "don't offer a choice that isn't real"
finding, reported as asked.
