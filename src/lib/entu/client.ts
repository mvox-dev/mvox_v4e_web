// src/lib/entu/client.ts
//
// Entu API client. Constructor accepts config explicitly (jwt + db + optional
// baseUrl) — no env reads here, the caller is responsible for sourcing config
// (BFF routes read $env/dynamic/private; CHORE-B browser code will read
// $env/dynamic/public + storage).
//
// Throws on !res.ok in all methods. The thrown Error includes the status code
// so the apiRequest wrapper layer (or the route handler) can react appropriately.

import { ENTU_API_BASE } from '../entu-config.ts';

export interface EntuEntity {
	_id: string;
	[key: string]: unknown;
}

export interface EntuSearchQuery {
	[key: string]: unknown;
}

export interface EntuClientConfig {
	jwt: string;
	db: string;
	baseUrl?: string;
}

export class EntuClient {
	private readonly jwt: string;
	private readonly baseUrl: string;
	private readonly db: string;

	constructor(config: EntuClientConfig) {
		this.jwt = config.jwt;
		this.baseUrl = config.baseUrl ?? ENTU_API_BASE;
		this.db = config.db;
	}

	private authHeaders(): HeadersInit {
		return { Authorization: `Bearer ${this.jwt}` };
	}

	private entityUrl(entityId: string): string {
		return `${this.baseUrl}${this.db}/entity/${entityId}`;
	}

	async get(entityId: string): Promise<EntuEntity> {
		const res = await fetch(this.entityUrl(entityId), {
			headers: this.authHeaders(),
		});
		if (!res.ok) {
			throw new Error(`Entu get ${entityId} failed: ${res.status}`);
		}
		const body = (await res.json()) as { entity: EntuEntity };
		return body.entity;
	}

	async search(query: EntuSearchQuery): Promise<EntuEntity[]> {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(query)) {
			if (v !== undefined) params.set(k, String(v));
		}
		const url = `${this.baseUrl}${this.db}/entity?${params.toString()}`;
		const res = await fetch(url, { headers: this.authHeaders() });
		if (!res.ok) {
			throw new Error(`Entu search failed: ${res.status}`);
		}
		const body = (await res.json()) as { entities: EntuEntity[] };
		return body.entities;
	}

	async setProperty(entityId: string, prop: string, value: string): Promise<{ _id: string }> {
		const url = `${this.baseUrl}${this.db}/property`;
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				...this.authHeaders(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ entity: entityId, type: prop, string: value }),
		});
		if (!res.ok) {
			throw new Error(`Entu setProperty failed: ${res.status}`);
		}
		return res.json() as Promise<{ _id: string }>;
	}
}
