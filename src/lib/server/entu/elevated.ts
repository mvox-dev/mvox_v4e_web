// Elevated BFF helpers — service-key-authed Entu calls.
// No SvelteKit deps; fully unit-testable via mocked global fetch.
// `db` is passed explicitly by callers (endpoints source it from env).
// Used by /api/invite/[token] and /api/invite/[token]/accept.

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

/** Mint an Entu service JWT from a raw API key.
 *  GETs ${ENTU_API_BASE}auth?db=${db} with Bearer apiKey.
 *  Throws if accounts is empty (no access) or response !ok. */
export async function mintJwt(_apiKey: string, _db: string): Promise<string> {
	throw new Error('not implemented');
}

/** Fetch a single Entu entity by id using the service JWT.
 *  GETs ${ENTU_API_BASE}${db}/entity/${id} with Bearer jwt.
 *  Returns the entity object. Throws on !ok. */
export async function readEntity(
	_jwt: string,
	_db: string,
	_id: string,
): Promise<Record<string, unknown>> {
	throw new Error('not implemented');
}

/** Resolve an invitation entity by its token property.
 *  Searches by _type.string=invitation and token.string=<token>.
 *  Returns InvitationProjection or null when not found. */
export async function resolveInvitationByToken(
	_jwt: string,
	_db: string,
	_token: string,
): Promise<InvitationProjection | null> {
	throw new Error('not implemented');
}

/** Resolve a person's name from their entity. */
export async function resolvePersonName(_jwt: string, _db: string, _personId: string): Promise<string> {
	throw new Error('not implemented');
}

/** Create a member entity (multi-parent: org + sections). Returns memberId.
 *  POST body: [_type(ref), _parent(orgId), one _parent per section, person(ref), name(str), status('active')]. */
export async function createMember(
	_jwt: string,
	_db: string,
	_input: MemberCreateInput,
): Promise<string> {
	throw new Error('not implemented');
}

/** Find an active member entity for a given person+org combination.
 *  Searches _type.string=member, person ref, _parent.reference=orgId, status.string=active.
 *  Returns null if not found. */
export async function findActiveMember(
	_jwt: string,
	_db: string,
	_opts: { personId: string; orgId: string },
): Promise<MemberRecord | null> {
	throw new Error('not implemented');
}

/** Delete an Entu entity by id. Uses DELETE /entity/{id}. */
export async function deleteEntity(_jwt: string, _db: string, _id: string): Promise<void> {
	throw new Error('not implemented');
}
