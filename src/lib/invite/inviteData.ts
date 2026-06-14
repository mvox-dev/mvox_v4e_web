// Client-side invite data helpers.
// Mirrors rsvpData.ts pattern: EntuCfg, local authHeaders, inline prop-array POST.
// Stub: not implemented. Byrd implements in GREEN.
import type { EntuCfg } from '$lib/seasons/entuSeasons';

export type { EntuCfg };

export interface InviteProjection {
	valid: boolean;
	expired?: boolean;
	orgName?: string;
	email?: string;
	sections?: string[];
	message?: string;
}

export interface CreateInvitationInput {
	orgId: string;
	email: string;
	sections?: string[];
	message?: string;
	inviterPersonId: string;
}

export interface CreateInvitationResult {
	invitationId: string;
	token: string;
}

export async function createInvitation(
	_cfg: EntuCfg,
	_input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
	throw new Error('not implemented');
}

export function buildInviteUrl(_origin: string, _token: string): string {
	throw new Error('not implemented');
}

export async function listOrgInvitations(
	_cfg: EntuCfg,
	_orgId: string,
): Promise<Array<{ invitationId: string; email: string; expiresAt: number; sections: string[] }>> {
	throw new Error('not implemented');
}

export async function resolveInvite(_token: string): Promise<InviteProjection> {
	throw new Error('not implemented');
}

export interface CreateApplicationInput {
	personId: string;
	orgId: string;
	message?: string;
}

export async function createApplication(
	_cfg: EntuCfg,
	_input: CreateApplicationInput,
): Promise<string> {
	throw new Error('not implemented');
}

export async function acceptInvite(
	_token: string,
	_opts: { applicationId: string },
): Promise<{ ok: boolean; orgId: string; alreadyMember?: boolean }> {
	throw new Error('not implemented');
}
