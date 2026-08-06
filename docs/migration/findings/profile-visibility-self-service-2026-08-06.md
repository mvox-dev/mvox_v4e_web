# Profile-visibility self-service — settled against entu-api source (2026-08-06)

(*MVOX:Perotin*)

Slice-3 #17 design fork raised by Mihkel: can a user self-manage the visibility of their own
`person` fields (a profile opt-out), or is visibility only a global prop-def/admin decision?
Settled by reading `~/projects/entu-api` source directly — no guessing at semantics.

## Q1 — does `_editor` let a user change VISIBILITY, not just value content?

**No.** `utils/entity.js` `setEntity()` defines two independent gates in `checkEntityAccess()`:

- L21-27: `rightTypes = ['_noaccess', '_viewer', '_expander', '_editor', '_owner', '_sharing', '_inheritrights']`
- L100-110: base write gate — user must be in the entity's `_editor` (or be `systemUser`), else 403.
- L113-118: **separate, additional gate** — if any property being written has a `type` in
  `rightTypes` (which includes `_sharing`), the user must be in the entity's `_owner` — `_editor`
  alone does not satisfy it:

  ```js
  const rigtsProperties = properties.filter((property) => rightTypes.includes(property.type))
  const owners = entity.private?._owner?.map((s) => s.reference?.toString()) || []
  if (rigtsProperties.length > 0 && !owners.includes(entu.userStr) && !entu.systemUser) {
    throw createError({ statusCode: 403, statusMessage: 'User not in _owner property' })
  }
  ```

`_editor` lets a user edit ordinary value properties (name, email, notes content). It does
**not** let them touch `_sharing`, `_owner`, `_viewer`, `_expander`, `_editor`, `_noaccess`, or
`_inheritrights` on that entity — those all require `_owner`, checked independently.

## Q2 — can a property VALUE carry its own `_sharing`, overriding the prop-def's tier?

**No.** `utils/aggregate.js` `aggregateEntity()` precomputes the `private`/`domain`/`public`
projections stored on the entity at write time. Per-field bucket membership (L112-154) is
computed purely from **the property-DEFINITION's** `_sharing` (`definition[d].sharing`, fetched
from the prop-def entities under the TYPE, L74-90), further capped by the **entity TYPE's own**
`_sharing` (`definitionSharing`, fetched from the type entity, L94):

```js
let sharing = definition[d].sharing
if (!definitionSharing) sharing = undefined
else if (definitionSharing === 'domain' && definition[d].sharing === 'public') sharing = 'domain'
// sharing is then used to decide whether dValue goes into newEntity.domain[...] / .public[...]
```

The loop never inspects anything about the individual value (`dValue = newEntity.private[definition[d].name]`)
itself — there is no per-value `_sharing` field consulted anywhere in this mechanism. Bucket
membership is uniform across **every instance** of that entity type for that field. A user
cannot mark their own `email` value private while the `email` prop-def is domain — the data
model has no slot for that distinction to live in.

## Q3 — confirm/refute: person-entity `_sharing` write needs `_owner`, not just `_editor`

**Confirmed**, and confirmed specifically for auto-provisioned persons: `routes/auth/index.get.js`
`createUserForAccount()` (the OAuth auto-provision path traced in the prior probe) grants the new
person only `_editor:self`, never `_owner:self`:

```js
// L330
await setEntity(entu, person._id, [{ type: '_editor', reference: person._id }])
```

Combined with Q1's gate: an auto-provisioned user can **never** write `_sharing` (or any
right-type property) on their own person entity — they don't hold the required `_owner`, only
`_editor`. This isn't a gap that could be worked around client-side; it's enforced server-side
on every write.

## Q4 — VERDICT

**Per-user, per-field visibility control is NOT achievable for a normal member on their own
token, on two independent grounds:**

1. Even if a user held `_owner` on their own person (they currently don't — see Q3), Entu's
   read-projection has no per-instance/per-value override slot at all (Q2) — visibility is
   computed once per property-definition and applied identically to every instance of that type.
   "My email private, everyone else's domain" isn't representable in the current data model.
2. Auto-provisioned users don't hold `_owner` on themselves in the first place (Q3), so even the
   entity-level `_sharing` (coarser than field-level) is out of reach — enforced by
   `checkEntityAccess`'s owner-gate (Q1).

**Conclusion: visibility is a global prop-def/admin decision, not self-service, as the system is
built today.**

**CORRECTED (team-lead, same day):** my first draft recommended an app-side opt-out field
applied "by the BFF." mvox has **no BFF** — it's browser-direct, and structurally can't have one
(Entu's JWT `aud` claim is IP-bound at mint time; a server-side proxy would break that binding).
Any client-side filtering of an already-domain-shared field is exactly the client-side-filtering
pattern Gama explicitly forbade for the roster slice: the data still reaches the client, so the
"boundary" is cosmetic, not real. That option is off the table for this app's architecture, not
just a nice-to-have simplification.

Honest option set, given no BFF exists or can exist:

- A genuine entu-api change to support per-value `_sharing` overrides in `aggregateEntity` — a
  real (upstream) rights-model change, big, out of scope for mvox to build/maintain solo.
- Granting real `_owner` to users on their own person, undoing the current deliberate
  `_editor`-only auto-provision boundary — plausible but its own blast radius, and STILL doesn't
  solve Q2's uniform-bucket limitation on its own (an owner could flip the whole entity's
  `_sharing`, but not a single field within it, without the aggregate.js change above too).

**Both require touching the rights model, not a near-term bolt-on.** No additive, architecture-
compatible middle option exists for this app as built. This is a forward-looking design decision
for Mihkel/Gama, not something to implement opportunistically.
