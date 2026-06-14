// Elevated BFF helpers — service-key-authed Entu calls.
// No SvelteKit deps; fully unit-testable via mocked global fetch.
// `db` is passed explicitly by callers (endpoints source it from env).
// Used by /api/invite/[token] and /api/invite/[token]/accept.
//
// These helpers run in ELEVATED mode (service-key-minted JWT), the only
// non-browser-direct data path in mvox — see the elevated-ops registry in
// teams/mvox-dev/memory/architecture-decisions.md and Path C decision.

import { ENTU_API_BASE } from '$lib/entu-config';

export interface MemberCreateInput {
	orgId: string;
	sections: string[];
	personId: string;
	name: string;
}

export interface InvitationProjection {
	invitationId: string;
	orgId: string;
	email: string;
	expiresAt: number; // ms
	sections: string[];
	message: string;
	token: string;
}

export interface MemberRecord {
	memberId: string;
	personId: string;
	orgId: string;
	status: string;
}

function authHeaders(jwt: string): HeadersInit {
	return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

/** Mint an Entu service JWT from a raw API key.
 *  GETs ${ENTU_API_BASE}auth?db=${db} with Bearer apiKey.
 *  Throws if accounts is empty (no access) or response !ok. */
export async function mintJwt(apiKey: string, db: string): Promise<string> {
	const res = await fetch(`${ENTU_API_BASE}auth?db=${db}`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!res.ok) {
		throw new Error(`mintJwt failed: ${res.status}`);
	}
	const body = (await res.json()) as {
		token?: string;
		accounts?: Record<string, unknown>;
	};
	if (!body.accounts || Object.keys(body.accounts).length === 0) {
		throw new Error('mintJwt: service key has no db access (accounts empty)');
	}
	if (!body.token) {
		throw new Error('mintJwt: no token in auth response');
	}
	return body.token;
}

/** Fetch a single Entu entity by id using the service JWT.
 *  GETs ${ENTU_API_BASE}${db}/entity/${id} with Bearer jwt.
 *  Returns the entity object (unwrapped from response.entity). Throws on !ok. */
export async function readEntity(
	jwt: string,
	db: string,
	id: string,
): Promise<Record<string, unknown>> {
	const res = await fetch(`${ENTU_API_BASE}${db}/entity/${id}`, {
		headers: authHeaders(jwt),
	});
	if (!res.ok) {
		throw new Error(`readEntity ${id} failed: ${res.status}`);
	}
	const body = (await res.json()) as { entity?: Record<string, unknown> };
	return body.entity ?? {};
}

/** Resolve an invitation entity by its token property.
 *  Searches by _type.string=invitation and token.string=<token>.
 *  Returns InvitationProjection or null when not found. */
export async function resolveInvitationByToken(
	jwt: string,
	db: string,
	token: string,
): Promise<InvitationProjection | null> {
	const res = await fetch(
		`${ENTU_API_BASE}${db}/entity?_type.string=invitation&token.string=${encodeURIComponent(token)}&props=_parent,token,email,expires_at,sections,message&limit=1`,
		{ headers: authHeaders(jwt) },
	);
	if (!res.ok) {
		throw new Error(`resolveInvitationByToken failed: ${res.status}`);
	}
	const body = (await res.json()) as {
		entities?: Array<{
			_id: string;
			_parent?: Array<{ reference: string }>;
			token?: Array<{ string: string }>;
			email?: Array<{ string: string }>;
			expires_at?: Array<{ date: string }>;
			sections?: Array<{ reference: string }>;
			message?: Array<{ string: string }>;
		}>;
	};
	const raw = body.entities?.[0];
	if (!raw) return null;
	return {
		invitationId: raw._id,
		orgId: raw._parent?.[0]?.reference ?? '',
		email: raw.email?.[0]?.string ?? '',
		expiresAt: new Date(raw.expires_at?.[0]?.date ?? 0).getTime(),
		sections: (raw.sections ?? []).map((s) => s.reference),
		message: raw.message?.[0]?.string ?? '',
		token: raw.token?.[0]?.string ?? '',
	};
}

/** Resolve a person's name from their entity. */
export async function resolvePersonName(jwt: string, db: string, personId: string): Promise<string> {
	const res = await fetch(`${ENTU_API_BASE}${db}/entity/${personId}?props=name`, {
		headers: authHeaders(jwt),
	});
	if (!res.ok) {
		throw new Error(`resolvePersonName ${personId} failed: ${res.status}`);
	}
	const body = (await res.json()) as { entity?: { name?: Array<{ string: string }> } };
	return body.entity?.name?.[0]?.string ?? '';
}

/** Resolve a type-definition entity id by its type name (mirrors entuSeasons.resolveTypeId
 *  but inlined to keep this server module free of the client seasons lib). */
async function resolveTypeId(jwt: string, db: string, typeName: string): Promise<string> {
	const res = await fetch(
		`${ENTU_API_BASE}${db}/entity?_type.string=entity&name.string=${encodeURIComponent(typeName)}&props=_id&limit=1`,
		{ headers: authHeaders(jwt) },
	);
	if (!res.ok) {
		throw new Error(`resolveTypeId '${typeName}' failed: ${res.status}`);
	}
	const body = (await res.json()) as { entities?: Array<{ _id: string }> };
	const id = body.entities?.[0]?._id;
	if (!id) {
		throw new Error(`type definition not found: '${typeName}' in db '${db}'`);
	}
	return id;
}

/** Create a member entity (multi-parent: org + sections). Returns memberId.
 *  POST body: [_type(ref), _parent(orgId), one _parent per section, person(ref), name(str), status('active')]. */
export async function createMember(
	jwt: string,
	db: string,
	input: MemberCreateInput,
): Promise<string> {
	const memberTypeId = await resolveTypeId(jwt, db, 'member');
	const props = [
		{ type: '_type', reference: memberTypeId },
		{ type: '_parent', reference: input.orgId },
		...input.sections.map((sectionId) => ({ type: '_parent', reference: sectionId })),
		{ type: 'person', reference: input.personId },
		{ type: 'name', string: input.name },
		{ type: 'status', string: 'active' },
	];
	const res = await fetch(`${ENTU_API_BASE}${db}/entity`, {
		method: 'POST',
		headers: authHeaders(jwt),
		body: JSON.stringify(props),
	});
	if (!res.ok) {
		throw new Error(`createMember failed: ${res.status}`);
	}
	const body = (await res.json()) as { _id: string };
	return body._id;
}

/** Find an active member entity for a given person+org combination.
 *  Searches _type.string=member, person ref, _parent.reference=orgId, status.string=active.
 *  Returns null if not found. */
export async function findActiveMember(
	jwt: string,
	db: string,
	opts: { personId: string; orgId: string },
): Promise<MemberRecord | null> {
	const res = await fetch(
		`${ENTU_API_BASE}${db}/entity?_type.string=member&person.reference=${opts.personId}&_parent.reference=${opts.orgId}&status.string=active&props=_parent,person,status&limit=1`,
		{ headers: authHeaders(jwt) },
	);
	if (!res.ok) {
		throw new Error(`findActiveMember failed: ${res.status}`);
	}
	const body = (await res.json()) as {
		entities?: Array<{
			_id: string;
			_parent?: Array<{ reference: string }>;
			person?: Array<{ reference: string }>;
			status?: Array<{ string: string }>;
		}>;
	};
	const raw = body.entities?.[0];
	if (!raw) return null;
	return {
		memberId: raw._id,
		personId: raw.person?.[0]?.reference ?? opts.personId,
		orgId: raw._parent?.[0]?.reference ?? opts.orgId,
		status: raw.status?.[0]?.string ?? '',
	};
}

/** Delete an Entu entity by id. Uses DELETE /entity/{id}
 *  (entity delete, NOT property-value delete — see project_entu_wire_shape_entity_vs_property). */
export async function deleteEntity(jwt: string, db: string, id: string): Promise<void> {
	const res = await fetch(`${ENTU_API_BASE}${db}/entity/${id}`, {
		method: 'DELETE',
		headers: authHeaders(jwt),
	});
	if (!res.ok) {
		throw new Error(`deleteEntity ${id} failed: ${res.status}`);
	}
}
