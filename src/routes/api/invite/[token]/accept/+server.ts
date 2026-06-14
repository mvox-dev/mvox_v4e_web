// POST /api/invite/[token]/accept — accept an invitation (public route, elevated).
//
// ELEVATED op (see elevated-ops registry in architecture-decisions.md). Path A
// identity model: the singer has ALREADY created an `application` entity under
// their OWN person (browser-direct, their own JWT) — that create is cryptographic
// proof of identity (only the person's JWT can write a child under their person).
// This endpoint reads application._parent as the verified accepter and uses the
// SERVICE KEY ONLY — never the user's JWT (it is IP-bound and 401s from CF;
// see project_entu_jwt_ip_bound). Body: { applicationId }.
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { env as privateEnv } from '$env/dynamic/private';
import {
	createMember,
	deleteEntity,
	findActiveMember,
	mintJwt,
	readEntity,
	resolveInvitationByToken,
	resolvePersonName,
} from '$lib/server/entu/elevated';

function resolveConfig(platform: App.Platform | undefined): {
	serviceKey: string | undefined;
	db: string;
} {
	if (platform?.env) {
		return {
			serviceKey: platform.env.ENTU_SERVICE_KEY,
			db: platform.env.PUBLIC_ENTU_DB ?? PUBLIC_ENTU_DB,
		};
	}
	return { serviceKey: privateEnv.ENTU_SERVICE_KEY, db: PUBLIC_ENTU_DB };
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const POST: RequestHandler = async ({ params, platform, request }) => {
	const token = params.token ?? '';
	const { serviceKey, db } = resolveConfig(platform);
	if (!serviceKey) {
		return json({ error: 'service unavailable' }, 500);
	}

	const { applicationId } = (await request.json()) as { applicationId?: string };

	// Service key ONLY — we never read or forward any user JWT from the request.
	const jwt = await mintJwt(serviceKey, db);

	// Re-verify the invitation between resolve and accept (it may have expired).
	const invitation = await resolveInvitationByToken(jwt, db, token);
	if (!invitation) {
		return json({ valid: false }, 404);
	}
	if (invitation.expiresAt < Date.now()) {
		return json({ expired: true }, 410);
	}

	// Read the application; application._parent is the verified person (identity proof).
	const application = await readEntity(jwt, db, applicationId ?? '');
	const personId = (application._parent as Array<{ reference: string }> | undefined)?.[0]
		?.reference;
	if (!personId) {
		return json({ error: 'identity proof missing' }, 403);
	}
	const targetOrg = (application.target_org as Array<{ reference: string }> | undefined)?.[0]
		?.reference;
	if (targetOrg !== invitation.orgId) {
		return json({ error: 'org mismatch' }, 403);
	}

	// Idempotency: if an active member already exists, skip create but still clean up.
	const existing = await findActiveMember(jwt, db, { personId, orgId: invitation.orgId });
	if (!existing) {
		const name = await resolvePersonName(jwt, db, personId);
		await createMember(jwt, db, {
			orgId: invitation.orgId,
			sections: invitation.sections,
			personId,
			name,
		});
	}

	// Best-effort cleanup — the member is the durable outcome. A failed delete is a
	// soft warning, not an error (mirrors deleteSeriesCascade's best-effort style).
	await cleanup(jwt, db, [invitation.invitationId, applicationId ?? '']);

	return json(
		existing
			? { ok: true, orgId: invitation.orgId, alreadyMember: true }
			: { ok: true, orgId: invitation.orgId },
		200,
	);
};

/** Delete invitation + application; swallow failures (member already created). */
async function cleanup(jwt: string, db: string, ids: string[]): Promise<void> {
	for (const id of ids) {
		if (!id) continue;
		try {
			await deleteEntity(jwt, db, id);
		} catch (err) {
			console.warn(`accept-invite cleanup: delete ${id} failed (soft)`, err);
		}
	}
}
