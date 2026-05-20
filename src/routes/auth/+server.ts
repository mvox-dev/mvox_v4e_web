import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

const DEFAULT_BASE_URL = 'https://entu.app/api/';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return json({ error: 'Missing Authorization header' }, { status: 401 });
	}

	const db = url.searchParams.get('db') ?? '';
	const baseUrl = process.env.ENTU_BASE_URL ?? DEFAULT_BASE_URL;
	const entuAuthUrl = `${baseUrl}${db}/auth`;

	const res = await fetch(entuAuthUrl, {
		method: 'GET',
		headers: { Authorization: authHeader },
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({})) as Record<string, unknown>;
		return json({ error: body?.error ?? 'Entu auth failed' }, { status: res.status });
	}

	const body = await res.json() as { token: string };

	cookies.set('entu_jwt', body.token, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 48 * 60 * 60,
		path: '/',
	});

	return json({ ok: true });
};
