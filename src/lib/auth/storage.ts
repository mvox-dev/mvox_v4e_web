// localStorage helpers — single source of truth for mvox auth key names.
// Mirrors entu/webapp's pattern for token/accounts/user; adds mvox-prefixed
// keys for last_provider + token_version.

const KEYS = {
	token: 'token',
	accounts: 'accounts',
	user: 'user',
	lastProvider: 'mvox.last_provider',
	tokenVersion: 'mvox.token_version',
} as const;

const CURRENT_TOKEN_VERSION = '1';

export interface EntuUser {
	_id: string;
	email?: string;
	name?: string;
	[key: string]: unknown;
}

export interface EntuAccount {
	_id: string;
	name?: string;
	[key: string]: unknown;
}

function isStaleVersion(): boolean {
	const stored = localStorage.getItem(KEYS.tokenVersion);
	return stored !== null && stored !== CURRENT_TOKEN_VERSION;
}

export function getToken(): string | null {
	if (isStaleVersion()) {
		clearAll({ preserveProvider: false });
		return null;
	}
	return localStorage.getItem(KEYS.token);
}

export function setToken(token: string): void {
	localStorage.setItem(KEYS.token, token);
	localStorage.setItem(KEYS.tokenVersion, CURRENT_TOKEN_VERSION);
}

export function getUser(): EntuUser | null {
	if (isStaleVersion()) {
		clearAll({ preserveProvider: false });
		return null;
	}
	const raw = localStorage.getItem(KEYS.user);
	return raw ? (JSON.parse(raw) as EntuUser) : null;
}

export function setUser(user: EntuUser): void {
	localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function getAccounts(): EntuAccount[] {
	if (isStaleVersion()) {
		clearAll({ preserveProvider: false });
		return [];
	}
	const raw = localStorage.getItem(KEYS.accounts);
	return raw ? (JSON.parse(raw) as EntuAccount[]) : [];
}

export function setAccounts(accounts: EntuAccount[]): void {
	localStorage.setItem(KEYS.accounts, JSON.stringify(accounts));
}

export function getLastProvider(): string | null {
	return localStorage.getItem(KEYS.lastProvider);
}

export function setLastProvider(provider: string): void {
	localStorage.setItem(KEYS.lastProvider, provider);
}

export function clearAll(opts: { preserveProvider: boolean }): void {
	localStorage.removeItem(KEYS.token);
	localStorage.removeItem(KEYS.accounts);
	localStorage.removeItem(KEYS.user);
	localStorage.removeItem(KEYS.tokenVersion);
	if (!opts.preserveProvider) {
		localStorage.removeItem(KEYS.lastProvider);
	}
	sessionStorage.clear();
}
