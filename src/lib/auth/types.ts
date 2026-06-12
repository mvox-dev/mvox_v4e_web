/**
 * Auth types — Path C client-side identity + org-membership state.
 *
 * The userStore hydrates from the localStorage Entu JWT (decode for the
 * person ID via JWT claims) + two Entu fetches per session: one for the
 * person's display name, one searching member entities to enumerate orgs.
 */

/**
 * A single organisation the user has membership in.
 *
 * `role` is captured here for future use (role-derived navbar chip CHORE)
 * but is not consumed by CHORE-66.
 */
export type Org = {
	/** Entu org entity ID. */
	id: string;
	/** Display name for chip + dropdown. */
	label: string;
	/** 1-3 character initials derived from label. */
	initials: string;
	/** Future use: 'librarian' | 'conductor' | 'admin' | 'member'. Omitted in CHORE-66. */
	role?: string;
};

/**
 * The resolved user state. The store moves through these tagged variants:
 *   loading → (signed-out | ready | error)
 *
 * `signed-out` is the terminal state when no JWT is present on mount.
 * `error` is reserved for fetch failure (JWT decode succeeded but Entu fetch failed).
 */
export type UserState =
	| { status: 'loading' }
	| { status: 'signed-out' }
	| { status: 'ready'; name: string; initial: string; personId: string; orgs: Org[] }
	| { status: 'error'; reason: string };

/**
 * Entu JWT payload shape.
 *
 * Empirically verified 2026-05-24 against polyphony via the API-key →
 * JWT exchange flow (`GET https://api.entu.app/auth?db=polyphony` with
 * `Authorization: Bearer <API_KEY>`):
 *
 *   { accounts: { polyphony: '<personId>' }, iat, exp, aud }
 *
 * Notes:
 * - No `sub` claim — the person ID lives at `accounts[<dbName>]`.
 * - `aud` is the caller's IP at mint time; Entu rejects calls from a
 *   different IP with 401 (see project_entu_jwt_ip_bound memory).
 *   Browser-direct Path C is intentionally compatible with this binding.
 */
export type EntuJwtClaims = {
	accounts: Record<string, string>;
	iat: number;
	exp: number;
	aud: string;
};

/**
 * v4E query contract — Person entity (display-name fetch).
 *
 * Endpoint: `GET https://api.entu.app/{db}/entity/{personId}?props=name`
 *   - {db} = polyphony (dev) | mvox (future prod)
 *   - Base URL form is the unified `api.entu.app/<db>/` per CHORE-50 — NOT per-db subdomains
 *     (architecture-decisions.md, ENTU_API_BASE). Production callers consume
 *     `src/lib/entu-config.ts` rather than hardcoding the base.
 *   - Authorization header: Bearer <JWT from localStorage>
 *   - Wire envelope: `{ entity: { _id, name: [{string}] } }` — note the `entity` wrapper.
 *
 * Empirical probe 2026-05-24 (Margus Roos, person `6a12036d4ff8277cd4306b93`):
 *   { entity: { _id: '6a12036d4ff8277cd4306b93', name: [{ string: 'Margus Roos' }] } }
 *
 * Mapping → `UserState.ready.name`: `person.entity.name?.[0]?.string ?? ''`.
 */
export type EntuPersonResponse = {
	entity: {
		_id: string;
		name?: Array<{ string: string }>;
	};
};

/**
 * v4E query contract — Member search (org enumeration).
 *
 * Endpoint: `GET https://api.entu.app/{db}/entity?_type.string=member&person.reference={personId}&props=_parent`
 *   - Searches member entities where the `person.reference` property matches the user's person ID.
 *   - `props=_parent` returns the multi-parent array inline with each member; each `_parent[]`
 *     entry carries `reference` (parent entity ID), `string` (parent name, denormalized),
 *     and `entity_type` (either `"organization"` or `"section"`).
 *
 * Empirical probe 2026-05-24 (Margus Roos, person `6a12036d4ff8277cd4306b93`):
 * ```
 * { count: 1, limit: 100, skip: 0,
 *   entities: [{
 *     _id: '6a12036e4ff8277cd4306b9a',
 *     _parent: [
 *       { reference: '69c7f871...', string: 'Eesti Filharmoonia Kammerkoor', entity_type: 'organization' },
 *       { reference: '69c7f876...', string: 'Bass',                          entity_type: 'section' }
 *     ]
 *   }] }
 * ```
 *
 * Mapping → `Org[]`:
 *   For each `entities[i]`:
 *     Filter `_parent` by `entity_type === 'organization'`.
 *     For each org parent: `{ id: parent.reference, label: parent.string,
 *                             initials: deriveInitials(parent.string), role: undefined }`.
 *
 * The denormalized `_parent[].string` avoids an N+1 per-org name fetch — a single
 * member-search round-trip resolves all of the user's org memberships.
 *
 * Out of scope for CHORE-66: founder-only orgs (where the user is `_owner` on an
 * organization entity but has no `member` row). Those will NOT appear in the
 * picker. If the picker needs to surface them later, union with a second search:
 * `?_type.string=organization&_owner.reference={personId}`.
 */
export type EntuMemberSearchResponse = {
	count: number;
	limit: number;
	skip: number;
	entities: Array<{
		_id: string;
		_parent?: Array<{
			reference: string;
			string: string;
			entity_type: string;
		}>;
	}>;
};

/**
 * v4E query contract — Owner org search (founder-affiliation).
 *
 * Endpoint: `GET https://api.entu.app/{db}/entity?_type.string=organization&_owner.reference={personId}&props=name`
 *   - Returns organization entities where the user holds `_owner` rights.
 *   - Used to surface founder-only orgs that have no `member` row.
 *
 * Mapping → `Org[]`: only insert if not already present from member-walk;
 * set `role: 'owner'` for these entries.
 */
export type EntuOwnerSearchResponse = {
	count: number;
	limit: number;
	skip: number;
	entities: Array<{
		_id: string;
		name?: Array<{ string: string }>;
	}>;
};

/**
 * Helper for chip/dropdown initials. 1-3 chars, uppercase, ASCII-fallback friendly.
 * Examples: "EFK Library" → "EL"; "Tartu Akadeemiline Meeskoor" → "TAM"; "Õla" → "Õ".
 */
export function deriveInitials(label: string): string {
	const words = label.trim().split(/\s+/).slice(0, 3);
	return words
		.map((w) => w[0]?.toLocaleUpperCase() ?? '')
		.join('')
		.slice(0, 3);
}
