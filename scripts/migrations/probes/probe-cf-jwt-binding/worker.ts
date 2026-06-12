/**
 * Scratch Worker: CF Worker IP-bound JWT mint+use probe.
 *
 * Modes:
 *   GET /          — mint a fresh JWT from ENTU_API_KEY + immediately use it (same invocation)
 *   GET /?stale=1  — use a JWT passed via X-Stale-Token header (demonstrates cross-IP failure)
 *
 * Returns JSON: { mintOk, useOk, useStatus, sameInvocation, mintLatencyMs, useLatencyMs }
 *
 * (*MVOX:Perotin*)
 */

const API_BASE = 'https://api.entu.app';
const DB = 'polyphony';

interface Env {
	ENTU_API_KEY: string;
}

interface AuthResponse {
	token: string;
}

interface EntityListResponse {
	entities: Array<{ _id: string }>;
	count: number;
}

async function mintJwt(apiKey: string): Promise<{ token: string; latencyMs: number }> {
	const url = `${API_BASE}/auth?db=${DB}`;
	const t0 = Date.now();
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});
	const latencyMs = Date.now() - t0;
	if (!res.ok) {
		throw new Error(`auth failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as AuthResponse;
	return { token: body.token, latencyMs };
}

async function useJwt(jwt: string): Promise<{ ok: boolean; status: number; latencyMs: number }> {
	// Read-only probe: list season entities, limit=1
	const url = `${API_BASE}/${DB}/entity?_type.string=season&props=_id&limit=1`;
	const t0 = Date.now();
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${jwt}` },
	});
	const latencyMs = Date.now() - t0;
	if (res.ok) {
		// consume body to release connection
		await res.json() as EntityListResponse;
	} else {
		await res.text();
	}
	return { ok: res.ok, status: res.status, latencyMs };
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const isStale = url.searchParams.has('stale');

		let mintOk = false;
		let mintLatencyMs: number | null = null;
		let token: string | null = null;
		let mintError: string | null = null;

		if (!isStale) {
			// Fresh mode: mint JWT from API key within this invocation
			try {
				const mint = await mintJwt(env.ENTU_API_KEY);
				token = mint.token;
				mintOk = true;
				mintLatencyMs = mint.latencyMs;
			} catch (err) {
				mintError = String(err);
			}
		} else {
			// Stale mode: use JWT passed in via header (expected to fail cross-IP)
			token = request.headers.get('X-Stale-Token');
			if (!token) {
				return new Response(
					JSON.stringify({ error: 'stale mode requires X-Stale-Token header' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } },
				);
			}
			// mintOk stays false — we didn't mint; token is external
		}

		let useOk = false;
		let useStatus: number | null = null;
		let useLatencyMs: number | null = null;
		let useError: string | null = null;

		if (token) {
			try {
				const use = await useJwt(token);
				useOk = use.ok;
				useStatus = use.status;
				useLatencyMs = use.latencyMs;
			} catch (err) {
				useError = String(err);
			}
		}

		const payload = {
			mode: isStale ? 'stale' : 'same-invocation',
			sameInvocation: !isStale,
			mintOk: isStale ? null : mintOk, // not applicable in stale mode
			mintLatencyMs,
			mintError,
			useOk,
			useStatus,
			useLatencyMs,
			useError,
			timestamp: new Date().toISOString(),
		};

		return new Response(JSON.stringify(payload, null, 2), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	},
};
