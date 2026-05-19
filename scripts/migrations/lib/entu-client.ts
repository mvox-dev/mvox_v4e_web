export const POLYPHONY_META_TYPE_ENTITY_ID = '69bcfd8e9c031ab8e6ce8034';
export const POLYPHONY_META_TYPE_PROPERTY_ID = '69bcfd8e9c031ab8e6ce8048';
export const POLYPHONY_DB_ENTITY_ID = '69bcfd8e9c031ab8e6ce807a';

export interface EntuClient {
	apiBase: string;
	db: string;
	jwt: string;
}

interface AuthResponse {
	token: string;
}

export async function getJwt(input: {
	apiBase: string;
	db: string;
	apiKey: string;
}): Promise<string> {
	const url = `${input.apiBase}/auth?db=${encodeURIComponent(input.db)}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${input.apiKey}` }
	});
	if (!res.ok) {
		throw new Error(`auth failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as AuthResponse;
	return body.token;
}

export interface EntuProperty {
	type: string;
	string?: string;
	number?: number;
	boolean?: boolean;
	reference?: string;
}

export interface CreateEntityResponse {
	_id: string;
	properties?: Array<{ _id: string; type: string; [key: string]: unknown }>;
}

export async function createEntity(
	client: EntuClient,
	properties: EntuProperty[]
): Promise<CreateEntityResponse> {
	const url = `${client.apiBase}/${client.db}/entity`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(properties)
	});
	if (!res.ok) {
		throw new Error(`create failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as CreateEntityResponse;
}

export interface ListEntitiesResponse {
	entities: Array<{ _id: string; [key: string]: unknown }>;
	count: number;
}

export async function listEntities(
	client: EntuClient,
	query: Record<string, string>
): Promise<ListEntitiesResponse> {
	const qs = new URLSearchParams(query).toString();
	const url = `${client.apiBase}/${client.db}/entity?${qs}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` }
	});
	if (!res.ok) {
		throw new Error(`list failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as ListEntitiesResponse;
}
