// Self-describing invite token — a base64url-encoded JSON payload carried in the
// /invite/<token> URL. The unauthed landing decodes it client-side and renders the
// invite WITHOUT reading the org-private `invitation` entity (Path C, no service key).
// Plain (unsigned) for MVP: tampering only lets a singer apply to an org that must
// still approve them — no privilege escalation (OD-2 locked decision; HMAC is a
// documented production-hardening follow-up).
import type { InviteToken } from '$lib/types';

const REQUIRED = ['orgId', 'orgName', 'inviterPersonId', 'sections', 'exp'] as const;

/** Encode an InviteToken as a URL-safe base64url string (no +, /, or = padding). */
export function encodeInviteToken(t: InviteToken): string {
	return btoa(JSON.stringify(t)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url invite token. Returns null on malformed input or a payload
 *  missing any required field. */
export function decodeInviteToken(s: string): InviteToken | null {
	try {
		const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
		const obj = JSON.parse(atob(b64)) as Record<string, unknown>;
		for (const key of REQUIRED) {
			if (!(key in obj)) return null;
		}
		return obj as unknown as InviteToken;
	} catch {
		return null;
	}
}
