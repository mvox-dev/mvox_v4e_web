const DEFAULT_BASE_URL = 'https://entu.app/api/';

export interface EntuEntity {
	_id: string;
	[key: string]: unknown;
}

export interface EntuSearchQuery {
	type?: string;
	[key: string]: unknown;
}

export class EntuClient {
	private readonly jwt: string;
	private readonly baseUrl: string;
	private readonly db: string;

	constructor(jwt: string) {
		this.jwt = jwt;
		this.baseUrl = process.env.ENTU_BASE_URL ?? DEFAULT_BASE_URL;
		this.db = process.env.ENTU_DB ?? '';
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
		const body = await res.json() as { entity: EntuEntity };
		return body.entity;
	}

	async search(query: EntuSearchQuery): Promise<EntuEntity[]> {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(query)) {
			if (v !== undefined) params.set(k, String(v));
		}
		const url = `${this.baseUrl}${this.db}/entity?${params.toString()}`;
		const res = await fetch(url, { headers: this.authHeaders() });
		const body = await res.json() as { entities: EntuEntity[] };
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
		return res.json() as Promise<{ _id: string }>;
	}
}
