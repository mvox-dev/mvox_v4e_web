// Client-safe redirect helpers.
// Extracted from src/lib/server/auth/session-cookie.ts so client code can use it
// without pulling in the server-only boundary.

/** Return a safe local redirect target, or `/` for anything non-local (open-redirect guard). */
export function safeRedirectTarget(raw: string | null): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}
