# Fix server-exchange personId extraction (accounts wire shape)

**Status:** APPROVED (team-lead, 2026-06-13). Root cause confirmed by LIVE PROBE — this unblocks the trusted-identity-at-issuance work (`c10f392`) and therefore slice-2b.

## Root cause (probed, not assumed)

The OAuth-key server exchange (`/auth/callback/+page.server.ts`) succeeds (HTTP 200 — refutes the IP-bound-key fear), but personId extraction fails → `exchange_no_account`.

Live `GET /auth?db=polyphony` response (probed 2026-06-13, owner key):
```
{ accounts: [ { _id: "polyphony", name: "polyphony", user: { _id: "69bcfd8e…", name: "Mihkel Putrinš" } } ],
  user: {...}, token: "<jwt>", expires: ... }
```
- Top-level `accounts` is an **ARRAY** of `{ _id: <db>, name, user: { _id: <personId>, name } }`.
- The token's CLAIMS carry a different shape — `accounts: { polyphony: "69bcfd8e…" }` (db→personId dict).

The callback wrongly read `data.accounts?.[PUBLIC_ENTU_DB]` — string-indexing the array → `undefined` → `exchange_no_account`. Both shapes hold the same personId.

**Why tests didn't catch it:** the trusted-identity RED mocked the response as `{ accounts: { testdb: 'person-77' } }` (object) — the mock encoded the same wrong assumption as the code, so it was green against a fabricated wire shape. The live probe is the source of truth (per `project_entu_create_type_reference` / partial-assertions lessons).

## Fix

In `+page.server.ts`, extract personId from the response `accounts` array by matching the db:

```ts
const data = (await res.json()) as {
	accounts?: Array<{ _id: string; user?: { _id: string } }>;
};
const pid = data.accounts?.find((a) => a._id === PUBLIC_ENTU_DB)?.user?._id;
if (!pid) {
	console.error('Entu exchange: no account for db in response');
	throw redirect(303, '/auth/login?error=exchange_no_account');
}
```

- Reads directly from the parsed response received over the trusted server→Entu channel (no token decode needed; equally trusted).
- Matches the `EntuAccount[]` shape already typed in `exchange.ts` (extend `EntuAccount` with optional `user?: { _id: string; name?: string }` if a shared type is cleaner — implementer's call).
- All other branches (`exchange_http_<status>`, `identity_sign_failed`, happy path, atomic cookies) unchanged.

## Testing (use the PROBED shape — no fabricated mocks)

Update `callback-page-server.spec.ts`:
- Happy path mock → real array shape `{ accounts: [{ _id: 'testdb', name: 'testdb', user: { _id: 'person-77' } }], token: '…' }`; assert personId `person-77` flows into the signed identity cookie (verify via real `verifyIdentity`).
- `exchange_no_account` → `{ accounts: [{ _id: 'OTHER_DB', user: { _id: 'x' } }] }` (array WITHOUT a matching db entry) → the code.
- Also accept empty `accounts: []` → `exchange_no_account`.
- Keep: `exchange_http_<status>`, `identity_sign_failed` (signIdentity throw), `missing_session_token`, atomic-cookie pins.

## Out of scope

The single-use-key question (Finn's original risk) is STILL unproven — it can only surface once the server exchange succeeds end-to-end and the client exchange runs next. This fix gets us there. If the PO re-login after this fix shows the client exchange 401ing, THAT is the single-use finding (separate follow-up).

**Chain (single-tree):** spec+plan → main → `fix/server-exchange-accounts-shape` → Tallis RED → Josquin GREEN → Bentham → merge → deploy → PO re-login.

(*MVOX:Palestrina*)
