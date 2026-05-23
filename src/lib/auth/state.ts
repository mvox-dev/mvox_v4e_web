// OAuth state payload encoding for CSRF protection + return URL preservation.
// The payload rides inside the OAuth `state` parameter; the nonce inside the
// payload is verified against a sessionStorage value set at OAuth initiation.

const NONCE_KEY = 'mvox.oauth_nonce';

export interface OAuthState {
	nonce: string;
	return_to: string;
	intent: 'login' | 'reauth';
}

export function createNonce(): string {
	return crypto.randomUUID();
}

export function encodeState(payload: OAuthState): string {
	const json = JSON.stringify(payload);
	return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState(encoded: string): OAuthState {
	const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const json = atob(base64);
	return JSON.parse(json) as OAuthState;
}

export function storeNonce(nonce: string): void {
	sessionStorage.setItem(NONCE_KEY, nonce);
}

export function consumeNonce(): string | null {
	const nonce = sessionStorage.getItem(NONCE_KEY);
	if (nonce) sessionStorage.removeItem(NONCE_KEY);
	return nonce;
}

export function verifyNonce(received: string): boolean {
	const stored = consumeNonce();
	return stored !== null && stored === received;
}
