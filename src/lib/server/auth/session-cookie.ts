// Server-only auth-session cookie helpers (CHORE-79).
// Pure functions — no SvelteKit imports — so they unit-test without a request.
//
// The cookie value is the Entu JWT (same token the client stores in localStorage).
// The server uses it ONLY as a soft auth gate: "is the user logged in?". Entu data
// calls stay browser-direct (the JWT is IP-bound — see project_entu_jwt_ip_bound).

export const SESSION_COOKIE = 'mvox_session';

/** Cookie attributes for the session cookie. `secure` is caller-supplied (false in dev). */
export function sessionCookieOptions(secure: boolean): {
	httpOnly: boolean;
	secure: boolean;
	sameSite: 'lax';
	path: string;
	maxAge: number;
} {
	return { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 48 };
}

/** Decode an unverified JWT and return its `exp` in milliseconds, or null on any malformed input. */
export function decodeJwtExpMs(token: string): number | null {
	const parts = token?.split('.');
	if (!parts || parts.length < 2) return null;
	try {
		const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
		return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
	} catch {
		return null;
	}
}

/** True iff a token is present and its decoded `exp` is in the future relative to `nowMs`. */
export function isSessionValid(token: string | undefined, nowMs: number): boolean {
	if (!token) return false;
	const expMs = decodeJwtExpMs(token);
	return expMs !== null && expMs > nowMs;
}

const PUBLIC_EXACT = new Set(['/', '/about']);

/** True iff the path requires a session. Public allowlist + assets/internal paths pass through. */
export function isProtectedPath(pathname: string): boolean {
	if (PUBLIC_EXACT.has(pathname)) return false;
	if (pathname.startsWith('/auth/')) return false;
	if (pathname.startsWith('/_app/') || pathname.startsWith('/.well-known')) return false;
	if (/\.[a-zA-Z0-9]+$/.test(pathname)) return false; // has a file extension → asset
	return true;
}

/** Return a safe local redirect target, or `/` for anything non-local (open-redirect guard). */
export function safeRedirectTarget(raw: string | null): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}
