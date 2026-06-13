import { ENTU_API_BASE } from '$lib/entu-config';
import { resolveTypeId, type EntuCfg } from '$lib/seasons/entuSeasons';

export type RsvpStatus = 'going' | 'not_going' | 'maybe' | 'late';

export interface MyRsvp {
	rsvpId: string;
	eventId: string;
	status: RsvpStatus;
}

export interface CreateRsvpInput {
	personId: string;
	eventId: string;
	memberId: string;
	status: RsvpStatus;
}

function authHeaders(token: string): HeadersInit {
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function listMyRsvps(cfg: EntuCfg, personId: string): Promise<MyRsvp[]> {
	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=rsvp&_parent.reference=${personId}&props=event,status&limit=500`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) {
		throw new Error(`listMyRsvps failed: ${res.status}`);
	}
	const body = (await res.json()) as {
		entities?: Array<{
			_id: string;
			event?: Array<{ reference: string }>;
			status?: Array<{ string: string }>;
		}>;
	};
	return (body.entities ?? []).map((raw) => ({
		rsvpId: raw._id,
		eventId: raw.event?.[0]?.reference ?? '',
		status: (raw.status?.[0]?.string ?? 'going') as RsvpStatus,
	}));
}

const memberIdCache = new Map<string, string | null>();

export async function findMyMemberId(
	cfg: EntuCfg,
	personId: string,
	orgId: string,
): Promise<string | null> {
	const key = `${cfg.db}:${personId}:${orgId}`;
	if (memberIdCache.has(key)) return memberIdCache.get(key)!;

	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=member&person.reference=${personId}&_parent.reference=${orgId}&status.string=active&props=_id&limit=1`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) {
		throw new Error(`findMyMemberId failed: ${res.status}`);
	}
	const body = (await res.json()) as { entities?: Array<{ _id: string }> };
	const id = body.entities?.[0]?._id ?? null;
	memberIdCache.set(key, id);
	return id;
}

export function resetMemberIdCache(): void {
	memberIdCache.clear();
}

export async function createRsvp(cfg: EntuCfg, input: CreateRsvpInput): Promise<string> {
	const rsvpTypeId = await resolveTypeId(cfg, 'rsvp');
	// No _sharing: parent (person) is private → child inherits private by default
	const props = [
		{ type: '_type', reference: rsvpTypeId },
		{ type: '_parent', reference: input.personId },
		{ type: 'event', reference: input.eventId },
		{ type: 'member', reference: input.memberId },
		{ type: 'status', string: input.status },
		{ type: `${input.status}_ref`, reference: input.eventId },
	];
	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity`, {
		method: 'POST',
		headers: authHeaders(cfg.token),
		body: JSON.stringify(props),
	});
	if (!res.ok) {
		throw new Error(`createRsvp failed: ${res.status}`);
	}
	const body = (await res.json()) as { _id: string };
	return body._id;
}

export async function updateRsvpStatus(
	cfg: EntuCfg,
	rsvpId: string,
	status: RsvpStatus,
): Promise<void> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	const getRes = await fetch(
		`${base}/entity/${rsvpId}?props=status,event,going_ref,not_going_ref,maybe_ref,late_ref`,
		{ headers },
	);
	if (!getRes.ok) throw new Error(`updateRsvpStatus lookup failed: ${getRes.status}`);
	const body = (await getRes.json()) as {
		entity?: {
			status?: Array<{ _id: string }>;
			event?: Array<{ reference: string }>;
			going_ref?: Array<{ _id: string }>;
			not_going_ref?: Array<{ _id: string }>;
			maybe_ref?: Array<{ _id: string }>;
			late_ref?: Array<{ _id: string }>;
		};
	};
	const entity = body.entity ?? {};
	const eventId = entity.event?.[0]?.reference ?? '';

	const toDelete = [
		...(entity.status ?? []),
		...(entity.going_ref ?? []),
		...(entity.not_going_ref ?? []),
		...(entity.maybe_ref ?? []),
		...(entity.late_ref ?? []),
	];
	for (const value of toDelete) {
		const delRes = await fetch(`${base}/property/${value._id}`, { method: 'DELETE', headers });
		if (!delRes.ok) throw new Error(`updateRsvpStatus delete failed: ${delRes.status}`);
	}

	const postRes = await fetch(`${base}/entity/${rsvpId}`, {
		method: 'POST',
		headers,
		body: JSON.stringify([
			{ type: 'status', string: status },
			{ type: `${status}_ref`, reference: eventId },
		]),
	});
	if (!postRes.ok) throw new Error(`updateRsvpStatus POST failed: ${postRes.status}`);
}

export interface RsvpTally {
	going: number;
	not_going: number;
	maybe: number;
	late: number;
}

export function parseTally(raw: string | undefined): RsvpTally {
	const zero: RsvpTally = { going: 0, not_going: 0, maybe: 0, late: 0 };
	if (raw === undefined) return zero;
	try {
		return { ...zero, ...JSON.parse(raw) };
	} catch {
		console.warn('parseTally: malformed input', raw);
		return zero;
	}
}

export async function deleteRsvp(cfg: EntuCfg, rsvpId: string): Promise<void> {
	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity/${rsvpId}`, {
		method: 'DELETE',
		headers: authHeaders(cfg.token),
	});
	if (!res.ok) throw new Error(`deleteRsvp failed: ${res.status}`);
}
