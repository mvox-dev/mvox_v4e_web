import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

function decodeJwtPayload(token: string): { exp?: unknown } | null {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	try {
		const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;
		return payload;
	} catch {
		return null;
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const csrfState = cookies.get('csrf_state');
	if (!csrfState) {
		return json({ error: 'csrf_missing' }, { status: 403 });
	}

	cookies.delete('csrf_state', { path: '/auth' });

	let body: { token?: unknown };
	try {
		body = (await request.json()) as { token?: unknown };
	} catch {
		return json({ error: 'invalid_body' }, { status: 400 });
	}

	const token = body.token;
	if (typeof token !== 'string' || token.length === 0) {
		return json({ error: 'missing_token' }, { status: 400 });
	}

	const payload = decodeJwtPayload(token);
	if (!payload) {
		return json({ error: 'malformed_jwt' }, { status: 400 });
	}

	const exp = payload.exp;
	if (typeof exp !== 'number' || exp <= Math.floor(Date.now() / 1000)) {
		return json({ error: 'expired_jwt' }, { status: 401 });
	}

	cookies.set('entu_jwt', token, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 48 * 60 * 60,
		path: '/',
	});

	return json({ ok: true });
};
