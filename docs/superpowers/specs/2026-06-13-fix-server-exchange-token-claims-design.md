# Fix server-exchange personId: read from TOKEN CLAIMS (proven client method)

**Status:** APPROVED (team-lead, 2026-06-13). Supersedes the accounts-array extraction (`597b0b2`) which still failed live with `exchange_no_account`.

## Root cause (definitive)

Two prior attempts read personId from the response top-level `accounts`:
1. `accounts[db]` (object index) — wrong, accounts is an array.
2. `accounts.find(a => a._id === db)?.user?._id` — the `user._id` field exists in the **API-key** exchange response (what I probed) but NOT in the **OAuth-session-key** exchange response (the real login flow). Different credential, different response shape. Still `exchange_no_account` live.

**The proven source:** the working client derives personId SOLELY from the JWT token claims:
- `userStore.ts:52-53`: `const claims = decodeJwt(token); const personId = claims?.accounts?.[PUBLIC_ENTU_DB];`
- The client NEVER reads `accounts[].user._id`. (`EntuJwtClaims.accounts` is the dict `{ polyphony: "<personId>" }`.)
- This path works in production for the real OAuth flow.

So the server must do the same: decode `data.token`'s claims and read `accounts[db]`. The token is what Entu returns from the server→Entu exchange over the trusted channel; decoding it to read claims is as trusted as the response itself (and is exactly what the client already trusts).

## Fix (`+page.server.ts`)

Replace the accounts-array extraction with token-claims extraction, with self-diagnosing sub-codes:

```ts
const data = (await res.json()) as { token?: string };
if (!data.token) {
	console.error('Entu exchange: no token in response');
	throw redirect(303, '/auth/login?error=exchange_no_token');
}
let claims: { accounts?: Record<string, string> } | null = null;
try {
	const seg = data.token.split('.')[1];
	claims = JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
} catch {
	console.error('Entu exchange: token claims undecodable');
	throw redirect(303, '/auth/login?error=exchange_bad_token');
}
const pid = claims?.accounts?.[PUBLIC_ENTU_DB];
if (!pid) {
	console.error('Entu exchange: claims.accounts missing db entry');
	throw redirect(303, '/auth/login?error=exchange_no_claim');
}
```

- `Buffer.from(seg, 'base64url')` — base64URL-correct (matches `session-cookie.ts:26`, proven in prod); avoids the client's `atob` which mishandles `-`/`_`.
- Sub-codes (`exchange_no_token` / `exchange_bad_token` / `exchange_no_claim`) replace the single `exchange_no_account` so a further failure self-identifies. Keep `exchange_http_<status>`, `identity_sign_failed`, atomic cookies, signing unchanged.

## Testing (use the PROVEN claim shape)

`callback-page-server.spec.ts`:
- Helper to build a token: `makeToken({ polyphony: 'person-77' })` → `header.<base64url(JSON.stringify({accounts:{testdb:'person-77'}}))>.sig`. The happy mock returns `{ token: makeToken(...) }` (drop the `accounts` array from the mock — it's unused now).
- Happy path → personId `person-77` from claims flows into the identity cookie (real verifyIdentity).
- no token → `exchange_no_token`.
- token with undecodable middle segment → `exchange_bad_token`.
- token whose claims.accounts lacks the db → `exchange_no_claim`.
- Keep: `exchange_http_401`, `identity_sign_failed`, `missing_session_token`, atomic cookie.

## Upstream-doc note (fold into the BFF draft)

Add to `docs/migration/findings/entu-auth-bff-docs-draft-2026-06-13.md`: **personId-for-a-db lives in the JWT claims `accounts[db]` (dict), which is stable across credential types. The response top-level `accounts` ARRAY shape varies by credential (API-key exchange includes `user._id`; OAuth-session-key exchange may not). BFFs should read identity from the token claims, not the response accounts array.** (Lesson: probe the REAL credential path, not the convenient one.)

**Chain (single-tree):** spec+plan → main → `fix/server-exchange-token-claims` → Tallis RED → Josquin GREEN → Bentham → merge → deploy → PO re-login.

(*MVOX:Palestrina*)
