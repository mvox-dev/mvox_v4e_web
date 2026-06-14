// GET /api/invite/[token] — resolve an invitation by token (public, elevated).
//
// ELEVATED op (see elevated-ops registry in architecture-decisions.md): mints a
// service JWT from ENTU_SERVICE_KEY and reads the org-private invitation the
// unauthed singer can't read themselves. Returns a MINIMAL projection only —
// never the token, inviter, invitationId, or full entity.
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { env as privateEnv } from '$env/dynamic/private';
import { mintJwt, readEntity, resolveInvitationByToken } from '$lib/server/entu/elevated';

/** Resolve the service key + db. On CF the platform.env is authoritative; in
 *  `pnpm dev`/tests (no platform) fall back to the static/dynamic env. */
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

export const GET: RequestHandler = async ({ params, platform }) => {
	const token = params.token ?? '';
	const { serviceKey, db } = resolveConfig(platform);
	if (!serviceKey) {
		return new Response(JSON.stringify({ error: 'service unavailable' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const jwt = await mintJwt(serviceKey, db);
	const invitation = await resolveInvitationByToken(jwt, db, token);
	if (!invitation) {
		return new Response(JSON.stringify({ valid: false }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const org = await readEntity(jwt, db, invitation.orgId);
	const orgName = (org.name as Array<{ string: string }> | undefined)?.[0]?.string ?? '';

	// Minimal projection — NEVER leak token / inviter / invitationId / full entity.
	return new Response(
		JSON.stringify({
			valid: true,
			expired: invitation.expiresAt < Date.now(),
			orgName,
			email: invitation.email,
			sections: invitation.sections,
			message: invitation.message,
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } },
	);
};
