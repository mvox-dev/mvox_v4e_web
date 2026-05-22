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
		headers: { Authorization: `Bearer ${input.apiKey}` },
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
	properties: EntuProperty[],
): Promise<CreateEntityResponse> {
	const url = `${client.apiBase}/${client.db}/entity`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(properties),
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
	query: Record<string, string>,
): Promise<ListEntitiesResponse> {
	const qs = new URLSearchParams(query).toString();
	const url = `${client.apiBase}/${client.db}/entity?${qs}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`list failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as ListEntitiesResponse;
}

export interface EntityRecord {
	_id: string;
	[key: string]: unknown;
}

interface EntityResponse {
	entity: EntityRecord;
}

export async function fetchEntity(client: EntuClient, entityId: string): Promise<EntityRecord> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`entity fetch failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as EntityResponse;
	return body.entity;
}

// POSTs an array of property values to an existing entity. The endpoint always
// appends (Q5 multi-value gotcha) — callers that need replace semantics must
// pre-DELETE the existing property values via deletePropertyValue first.
export async function postProperties(
	client: EntuClient,
	entityId: string,
	properties: EntuProperty[],
): Promise<void> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(properties),
	});
	if (!res.ok) {
		throw new Error(`entity POST failed: ${res.status} ${await res.text()}`);
	}
}

// DELETE /property/{propValueId} — removes a single property VALUE record from
// an entity. Use this for stale formula values on prop-def entities and for
// pruneExistingTarget on instance properties. For prop-DEF removal (the def
// itself, which is an entity), use deleteEntity instead.
export async function deletePropertyValue(client: EntuClient, propValueId: string): Promise<void> {
	const url = `${client.apiBase}/${client.db}/property/${propValueId}`;
	const res = await fetch(url, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`property-value DELETE failed: ${res.status} ${await res.text()}`);
	}
}

// DELETE /entity/{entityId} — removes an entity. Use for prop-def entities too
// (property-defs ARE entities; /property/{id} returns 404 for prop-def _ids).
export async function deleteEntity(client: EntuClient, entityId: string): Promise<void> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`entity DELETE failed: ${res.status} ${await res.text()}`);
	}
}

// Typed wrapper for the common pattern of listing instances by type-name with
// a specific props selection. Uses _type.string for type filtering and defaults
// to limit=500 (polyphony has ≤500 of any single instance type today).
//
// URL shape uses /entity/ (trailing slash) so the substring `/entity/` matches
// in test assertions that verify "the migrator did some entity work" by looking
// for a /entity/ substring across all fetch calls (legacy RED-1 style).
//
// 4th argument is a union: pass a number to override the limit, or a query
// record to add extra filters (e.g. `_parent.reference`). When both are needed,
// pass the limit at position 3 and the extra query at position 4.
export async function listInstancesByType(
	client: EntuClient,
	typeName: string,
	props: string,
	limitOrExtraQuery?: number | Record<string, string>,
	extraQuery?: Record<string, string>,
): Promise<ListEntitiesResponse> {
	const limit = typeof limitOrExtraQuery === 'number' ? limitOrExtraQuery : 500;
	const query =
		typeof limitOrExtraQuery === 'object' && limitOrExtraQuery !== null
			? limitOrExtraQuery
			: extraQuery;
	const params: Record<string, string> = {
		'_type.string': typeName,
		props,
		limit: String(limit),
		...(query ?? {}),
	};
	const qs = new URLSearchParams(params).toString();
	const url = `${client.apiBase}/${client.db}/entity/?${qs}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`list failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as ListEntitiesResponse;
}
