// Elevated BFF helpers — service-key-authed Entu calls.
// No SvelteKit deps; fully unit-testable via mocked global fetch.
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

/** Mint an Entu service JWT from a raw API key. */
export async function mintJwt(_apiKey: string): Promise<string> {
	throw new Error('not implemented');
}

/** Fetch a single Entu entity by id using the service JWT. */
export async function readEntity(
	_jwt: string,
	_id: string,
): Promise<Record<string, unknown>> {
	throw new Error('not implemented');
}

/** Resolve an invitation entity by its token property. Returns null when not found. */
export async function resolveInvitationByToken(
	_jwt: string,
	_token: string,
): Promise<InvitationProjection | null> {
	throw new Error('not implemented');
}

/** Resolve a person's name from their entity. */
export async function resolvePersonName(_jwt: string, _personId: string): Promise<string> {
	throw new Error('not implemented');
}

/** Create a member entity (multi-parent: org + sections). Returns memberId. */
export async function createMember(
	_jwt: string,
	_input: MemberCreateInput,
): Promise<string> {
	throw new Error('not implemented');
}

/** Find an active member entity for a given person+org combination. Returns null if absent. */
export async function findActiveMember(
	_jwt: string,
	_opts: { personId: string; orgId: string },
): Promise<MemberRecord | null> {
	throw new Error('not implemented');
}

/** Delete an Entu entity by id. */
export async function deleteEntity(_jwt: string, _id: string): Promise<void> {
	throw new Error('not implemented');
}
