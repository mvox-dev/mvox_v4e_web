// Client-side invite data helpers.
// Mirrors rsvpData.ts pattern: EntuCfg, local authHeaders, inline prop-array POST.
import { ENTU_API_BASE } from '$lib/entu-config';
import { resolveTypeId, type EntuCfg } from '$lib/seasons/entuSeasons';

export type { EntuCfg };

export interface InviteProjection {
	valid: boolean;
	expired?: boolean;
	orgId?: string; // required: client reads this for createApplication call
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

function authHeaders(token: string): HeadersInit {
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function createInvitation(
	cfg: EntuCfg,
	input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
	const invitationTypeId = await resolveTypeId(cfg, 'invitation');
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

	const props: Array<{ type: string; string?: string; reference?: string; date?: string }> = [
		{ type: '_type', reference: invitationTypeId },
		{ type: '_parent', reference: input.orgId },
		{ type: 'email', string: input.email },
		{ type: 'token', string: token },
		{ type: 'expires_at', date: expiresAt },
		{ type: 'status', string: 'active' },
	];

	if (input.sections) {
		for (const sectionId of input.sections) {
			props.push({ type: 'sections', reference: sectionId });
		}
	}
	if (input.message) {
		props.push({ type: 'message', string: input.message });
	}

	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity`, {
		method: 'POST',
		headers: authHeaders(cfg.token),
		body: JSON.stringify(props),
	});
	if (!res.ok) {
		throw new Error(`createInvitation failed: ${res.status}`);
	}
	const body = (await res.json()) as { _id: string };
	return { invitationId: body._id, token };
}

export function buildInviteUrl(origin: string, token: string): string {
	return `${origin.replace(/\/$/, '')}/invite/${token}`;
}

export async function listOrgInvitations(
	cfg: EntuCfg,
	orgId: string,
): Promise<Array<{ invitationId: string; email: string; expiresAt: number; sections: string[] }>> {
	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=invitation&_parent.reference=${orgId}&props=email,expires_at,sections&limit=500`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) {
		throw new Error(`listOrgInvitations failed: ${res.status}`);
	}
	const body = (await res.json()) as {
		entities?: Array<{
			_id: string;
			email?: Array<{ string: string }>;
			expires_at?: Array<{ date: string }>;
			sections?: Array<{ reference: string }>;
		}>;
	};
	return (body.entities ?? []).map((raw) => ({
		invitationId: raw._id,
		email: raw.email?.[0]?.string ?? '',
		expiresAt: raw.expires_at?.[0]?.date ? new Date(raw.expires_at[0].date).getTime() : 0,
		sections: (raw.sections ?? []).map((s) => s.reference),
	}));
}

export async function resolveInvite(token: string): Promise<InviteProjection> {
	const res = await fetch(`/api/invite/${token}`);
	if (!res.ok) {
		throw new Error(`resolveInvite failed: ${res.status}`);
	}
	return (await res.json()) as InviteProjection;
}

export interface CreateApplicationInput {
	personId: string;
	orgId: string;
	message?: string;
}

export async function createApplication(
	cfg: EntuCfg,
	input: CreateApplicationInput,
): Promise<string> {
	const applicationTypeId = await resolveTypeId(cfg, 'application');
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

	// _parent = personId is the identity proof: only the person entity owner can POST here
	const props: Array<{ type: string; string?: string; reference?: string; date?: string }> = [
		{ type: '_type', reference: applicationTypeId },
		{ type: '_parent', reference: input.personId },
		{ type: 'target_org', reference: input.orgId },
		{ type: 'status', string: 'active' },
		{ type: 'expires_at', date: expiresAt },
	];
	if (input.message) {
		props.push({ type: 'message', string: input.message });
	}

	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity`, {
		method: 'POST',
		headers: authHeaders(cfg.token),
		body: JSON.stringify(props),
	});
	if (!res.ok) {
		throw new Error(`createApplication failed: ${res.status}`);
	}
	const body = (await res.json()) as { _id: string };
	return body._id;
}

export async function acceptInvite(
	token: string,
	opts: { applicationId: string },
): Promise<{ ok: boolean; orgId: string; alreadyMember?: boolean }> {
	const res = await fetch(`/api/invite/${token}/accept`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ applicationId: opts.applicationId }),
	});
	if (!res.ok) {
		throw new Error(`acceptInvite failed: ${res.status}`);
	}
	return (await res.json()) as { ok: boolean; orgId: string; alreadyMember?: boolean };
}
