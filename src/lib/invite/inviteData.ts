// Client-side invite/join data helpers (native keyless design, #91/#92).
//
// All calls run browser-direct on the authenticated user's JWT (Path C) — NO service
// key, NO BFF data route. Mirrors the entuSeasons.ts convention: raw `fetch` against
// `${ENTU_API_BASE}${db}/...`, local `authHeaders`, entity-create as a flat array of
// `{ type, string|reference|date }` prop objects.
//
// Flow (admin-initiated):
//   1. Admin (org _owner JWT)   → createInvitation (org-child, carries inviter person id)
//   2. Singer (own JWT)         → createApplication (own-person child, private, pending)
//                               → grantEditorToAdmin (so the admin's LIST surfaces it AND
//                                 the admin can soft-close it on approve — probe #92, OD-1)
//   3. Admin (own _owner JWT)   → listPendingApplications → approveApplication (create member
//                                 + org _viewer sync + soft-close application + delete invitation)
import { ENTU_API_BASE } from '$lib/entu-config';
import { resolveTypeId, type EntuCfg } from '$lib/seasons/entuSeasons';
import { encodeInviteToken } from '$lib/invite/inviteToken';
import type {
	CreateInvitationInput,
	CreateInvitationResult,
	CreateApplicationInput,
	PendingApplication,
} from '$lib/types';

export type { EntuCfg };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function authHeaders(token: string): HeadersInit {
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** YYYY-MM-DD, `now + 30 days`. `expires_at` is an Entu `date` (not datetime). */
function expiresAtDate(): string {
	return new Date(Date.now() + THIRTY_DAYS_MS).toISOString().split('T')[0];
}

type EntuProp =
	| { type: string; string: string }
	| { type: string; reference: string }
	| { type: string; date: string };

// ── createInvitation (admin) ────────────────────────────────────────────────────

export async function createInvitation(
	cfg: EntuCfg,
	input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
	const invitationTypeId = await resolveTypeId(cfg, 'invitation');
	const expMs = Date.now() + THIRTY_DAYS_MS;
	const token = encodeInviteToken({
		orgId: input.orgId,
		orgName: input.orgName ?? '',
		inviterPersonId: input.inviterPersonId,
		sections: input.sections ?? [],
		exp: expMs,
	});

	const props: EntuProp[] = [
		{ type: '_type', reference: invitationTypeId },
		{ type: '_parent', reference: input.orgId },
		{ type: 'email', string: input.email },
		{ type: 'token', string: token },
		{ type: 'expires_at', date: expiresAtDate() },
		{ type: 'inviter', reference: input.inviterPersonId },
	];
	for (const sectionId of input.sections ?? []) {
		props.push({ type: 'sections', reference: sectionId });
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

/** Build the copyable invite URL for a token. */
export function buildInviteUrl(origin: string, token: string): string {
	return `${origin.replace(/\/$/, '')}/invite/${token}`;
}

// ── createApplication (singer) ──────────────────────────────────────────────────

export async function createApplication(
	cfg: EntuCfg,
	input: CreateApplicationInput,
): Promise<{ applicationId: string }> {
	const applicationTypeId = await resolveTypeId(cfg, 'application');

	// _parent = personId is the identity proof: only the person's own JWT can POST a
	// child under their person. _sharing MUST be set explicitly — the person entity is
	// public by default, so a child would otherwise materialise as public (C4).
	const props: EntuProp[] = [
		{ type: '_type', reference: applicationTypeId },
		{ type: '_parent', reference: input.personId },
		{ type: 'target_org', reference: input.orgId },
		{ type: 'status', string: 'pending' },
		{ type: '_sharing', string: 'private' },
		{ type: 'expires_at', date: expiresAtDate() },
	];

	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity`, {
		method: 'POST',
		headers: authHeaders(cfg.token),
		body: JSON.stringify(props),
	});
	if (!res.ok) {
		throw new Error(`createApplication failed: ${res.status}`);
	}
	const body = (await res.json()) as { _id: string };
	return { applicationId: body._id };
}

// ── grantEditorToAdmin (singer grants the inviting admin _editor on the application) ─

/** Grant the admin person `_editor` on the singer's application. `_editor` (vs `_viewer`)
 *  gives the admin both LIST-discovery (probe #92) and delete-at-approve (OD-1). The
 *  singer is `_owner` of their own application, so this runs on the singer's own JWT.
 *  Mirrors assignConductor's grant pattern (POST a rights ref onto the entity). */
export async function grantEditorToAdmin(
	cfg: EntuCfg,
	input: { applicationId: string; adminPersonId: string },
): Promise<void> {
	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity/${input.applicationId}`, {
		method: 'POST',
		headers: authHeaders(cfg.token),
		body: JSON.stringify([{ type: '_editor', reference: input.adminPersonId }]),
	});
	if (!res.ok) {
		throw new Error(`grantEditorToAdmin failed: ${res.status}`);
	}
}

// ── listPendingApplications (admin) ─────────────────────────────────────────────

interface ApplicationRaw {
	_id: string;
	_parent?: Array<{ reference: string }>;
	message?: Array<{ string: string }>;
	sections?: Array<{ reference: string }>;
}

/** List the org's pending applications. The `_editor`-granted applications surface in
 *  this filtered LIST for the admin (probe #92). Resolves each applicant's name via a
 *  second GET on their person entity (two-fetch pattern, mirrors listOrgMembers). */
export async function listPendingApplications(
	cfg: EntuCfg,
	orgId: string,
): Promise<PendingApplication[]> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	const res = await fetch(
		`${base}/entity?_type.string=application&target_org.reference=${orgId}&status.string=pending&props=_parent,target_org,message,sections,_editor&limit=500`,
		{ headers },
	);
	if (!res.ok) {
		throw new Error(`listPendingApplications failed: ${res.status}`);
	}
	const body = (await res.json()) as { entities?: ApplicationRaw[] };
	const raws = body.entities ?? [];

	return Promise.all(
		raws.map(async (raw) => {
			const personId = raw._parent?.[0]?.reference ?? '';
			let applicantName = '';
			if (personId) {
				const personRes = await fetch(`${base}/entity/${personId}?props=name`, { headers });
				if (personRes.ok) {
					const personBody = (await personRes.json()) as {
						entity?: { name?: Array<{ string: string }> };
					};
					applicantName = personBody.entity?.name?.[0]?.string ?? '';
				}
			}
			const sections = raw.sections?.map((s) => s.reference);
			return {
				applicationId: raw._id,
				personId,
				applicantName,
				message: raw.message?.[0]?.string,
				sections: sections && sections.length > 0 ? sections : undefined,
			};
		}),
	);
}

// ── approveApplication (admin) → member ─────────────────────────────────────────

/** Approve a pending application on the admin's own `_owner` JWT:
 *  1. create the `member` (org + section parents, person ref, status active — NO name);
 *  2. sync `_viewer` for the new member person on the org (membership-rights invariant);
 *  3. soft-close the application via `status: 'approved'` — NOT an entity delete. The admin
 *     holds only `_editor` on the singer's application (granted at accept), and `_editor`
 *     cannot `DELETE /entity/{id}` (403 — needs `_owner`); but it CAN `DELETE /property/{id}`
 *     + POST props. So we clear the existing 'pending' status value(s) then POST 'approved'
 *     (plain POST appends — the old value must be deleted first or it lingers in the pending
 *     LIST). Empirically confirmed by Pérotin's `_editor` smoke (main `beb1c87`/`91daa4b`).
 *  4. best-effort delete the invitation (admin IS org `_owner` of it → entity delete works).
 *  Steps 1+2 throw on failure (the member is the durable outcome). Steps 3+4 are best-effort
 *  — the application self-expires via `expires_at` if soft-close fails (OD-1). */
export async function approveApplication(
	cfg: EntuCfg,
	input: {
		applicationId: string;
		invitationId: string;
		orgId: string;
		personId: string;
		sections: string[];
	},
): Promise<void> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	// 1. Create the member (multi-parent: org + sections). Member has NO `name` prop —
	//    identity lives on the linked person (schema member.notes).
	const memberTypeId = await resolveTypeId(cfg, 'member');
	const memberProps: EntuProp[] = [
		{ type: '_type', reference: memberTypeId },
		{ type: '_parent', reference: input.orgId },
		...input.sections.map((sectionId) => ({ type: '_parent', reference: sectionId })),
		{ type: 'person', reference: input.personId },
		{ type: 'status', string: 'active' },
	];
	const memberRes = await fetch(`${base}/entity`, {
		method: 'POST',
		headers,
		body: JSON.stringify(memberProps),
	});
	if (!memberRes.ok) {
		throw new Error(`approveApplication member create failed: ${memberRes.status}`);
	}

	// 2. Role→ACL sync: grant the new member person `_viewer` on the org (membership-rights
	//    invariant; admin's `_owner` cascade allows it — README §6.2).
	const viewerRes = await fetch(`${base}/entity/${input.orgId}`, {
		method: 'POST',
		headers,
		body: JSON.stringify([{ type: '_viewer', reference: input.personId }]),
	});
	if (!viewerRes.ok) {
		throw new Error(`approveApplication org _viewer sync failed: ${viewerRes.status}`);
	}

	// 3. Soft-close the application: status 'pending' → 'approved' (best-effort). The admin's
	//    `_editor` can't delete the entity, but can clear-then-set the status property.
	await softCloseApplication(base, headers, input.applicationId);

	// 4. Best-effort delete the invitation (admin owns it as org `_owner`); on failure it
	//    self-expires via `expires_at`.
	await deleteEntityBestEffort(base, headers, input.invitationId);
}

/** Clear the application's existing `status` value(s) then POST `status: 'approved'`.
 *  Plain POST appends, so the 'pending' value must be deleted first or the application
 *  keeps surfacing in the pending LIST. All steps are `_editor`-sufficient. Best-effort. */
async function softCloseApplication(
	base: string,
	headers: HeadersInit,
	applicationId: string,
): Promise<void> {
	if (!applicationId) return;
	try {
		// Step 1: read the current status value _id(s).
		const getRes = await fetch(`${base}/entity/${applicationId}?props=status`, { headers });
		if (getRes.ok) {
			const body = (await getRes.json()) as {
				entity?: { status?: Array<{ _id?: string }> };
			};
			// Step 2: DELETE each existing status property VALUE (DELETE /property/{valueId}).
			for (const value of body.entity?.status ?? []) {
				if (!value._id) continue;
				const delRes = await fetch(`${base}/property/${value._id}`, { method: 'DELETE', headers });
				if (!delRes.ok) {
					console.warn(`softCloseApplication: clear status ${value._id} failed: ${delRes.status}`);
				}
			}
		} else {
			console.warn(`softCloseApplication: status GET ${applicationId} failed: ${getRes.status}`);
		}
		// Step 3: POST the new status value.
		const postRes = await fetch(`${base}/entity/${applicationId}`, {
			method: 'POST',
			headers,
			body: JSON.stringify([{ type: 'status', string: 'approved' }]),
		});
		if (!postRes.ok) {
			console.warn(
				`softCloseApplication: set approved on ${applicationId} failed: ${postRes.status}`,
			);
		}
	} catch (err) {
		console.warn(`softCloseApplication: ${applicationId} threw (soft)`, err);
	}
}

async function deleteEntityBestEffort(
	base: string,
	headers: HeadersInit,
	id: string,
): Promise<void> {
	if (!id) return;
	try {
		const res = await fetch(`${base}/entity/${id}`, { method: 'DELETE', headers });
		if (!res.ok) {
			console.warn(`approveApplication cleanup: delete ${id} failed (soft): ${res.status}`);
		}
	} catch (err) {
		console.warn(`approveApplication cleanup: delete ${id} threw (soft)`, err);
	}
}
