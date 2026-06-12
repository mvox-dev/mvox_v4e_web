// Server-only identity cookie — HMAC-SHA256 signed payload minted at OAuth callback.
// Web Crypto only (no Node crypto) — CF Workers compatible.

export interface IdentityPayload {
	personId: string;
	iat: number;
	exp: number;
}

const enc = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

function b64url(bytes: ArrayBuffer): string {
	return Buffer.from(bytes).toString('base64url');
}

export async function signIdentity(payload: IdentityPayload, secret: string): Promise<string> {
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
	return `${body}.${b64url(sig)}`;
}

export async function verifyIdentity(
	cookieValue: string,
	secret: string,
	nowMs: number,
): Promise<{ personId: string } | null> {
	const dot = cookieValue.lastIndexOf('.');
	if (dot <= 0) return null;
	const body = cookieValue.slice(0, dot);
	const sigB64 = cookieValue.slice(dot + 1);
	let sig: Uint8Array<ArrayBuffer>;
	try {
		const buf = Buffer.from(sigB64, 'base64url');
		sig = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	} catch {
		return null;
	}
	const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(body));
	if (!ok) return null;
	try {
		const payload = JSON.parse(
			Buffer.from(body, 'base64url').toString('utf8'),
		) as IdentityPayload;
		if (typeof payload.personId !== 'string' || typeof payload.exp !== 'number') return null;
		if (payload.exp * 1000 <= nowMs) return null;
		return { personId: payload.personId };
	} catch {
		return null;
	}
}
