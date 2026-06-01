import { ENTU_API_BASE } from '$lib/entu-config';
import { occurrenceDates, toStartDatetime } from './recurrence';
import type {
	Conductor,
	OrgMember,
	Rehearsal,
	RehearsalRaw,
	RehearsalSeries,
	Season,
	SeasonRaw,
	SeriesRaw,
} from './types';

export interface EntuCfg {
	db: string;
	token: string;
}

/** Property objects in an Entu entity-create body — one of the typed value shapes. */
type EntuProp =
	| { type: string; string: string }
	| { type: string; reference: string }
	| { type: string; date: string }
	| { type: string; datetime: string }
	| { type: string; number: number };

// Entu's create endpoint requires `_type` posted as a REFERENCE to the type-entity
// id, not `{ string: 'season' }` — the string form returns HTTP 400. These ids are
// the polyphony type entities (verified working from scripts seed-demo-seasons.ts).
// FOLLOW-UP: resolve these per-db at runtime (GET ?_type.string=entity&name.string=<type>)
// instead of hardcoding polyphony ids — tracked separately.
const TYPE_IDS = {
	season: '69c7ea528489bfcb0e81a044',
	event_series: '6a0d2e8490c8df7a1cc7deb1',
	event: '69c7ea548489bfcb0e81a0a2',
} as const;

export interface CreateSeasonInput {
	orgId: string;
	name: string;
	startDate: string;
	endDate: string;
}

export interface CreateSeriesInput {
	orgId: string;
	seasonId: string;
	name: string;
	intervalDays: number;
	startTime: string;
	durationMinutes: number;
	startDate: string;
	endDate: string;
	location?: string;
}

export interface CreateSeriesResult {
	seriesId: string;
	eventIds: string[];
}

/**
 * Thrown when event generation fails part-way through a series create. The
 * series and the events created before the failure are NOT rolled back
 * (spec §4 — best-effort, no rollback); the caller surfaces a partial notice.
 */
export class PartialGenerationError extends Error {
	readonly seriesId: string;
	readonly createdCount: number;
	constructor(seriesId: string, createdCount: number, cause?: unknown) {
		super(`series ${seriesId}: generated ${createdCount} event(s) before failure`);
		this.name = 'PartialGenerationError';
		this.seriesId = seriesId;
		this.createdCount = createdCount;
		if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
	}
}

function authHeaders(token: string): HeadersInit {
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** POST an Entu entity-create property array; returns the new entity `_id`. */
async function createEntity(cfg: EntuCfg, props: EntuProp[]): Promise<string> {
	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity`, {
		method: 'POST',
		headers: authHeaders(cfg.token),
		body: JSON.stringify(props),
	});
	if (!res.ok) {
		throw new Error(`entity create failed: ${res.status}`);
	}
	const body = (await res.json()) as { _id: string };
	return body._id;
}

export async function createSeason(cfg: EntuCfg, input: CreateSeasonInput): Promise<string> {
	return createEntity(cfg, [
		{ type: '_type', reference: TYPE_IDS.season },
		{ type: '_parent', reference: input.orgId },
		{ type: '_sharing', string: 'public' },
		{ type: 'name', string: input.name },
		{ type: 'start_date', date: input.startDate },
		{ type: 'end_date', date: input.endDate },
	]);
}

export async function listSeasons(cfg: EntuCfg, orgId: string): Promise<Season[]> {
	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=season&_parent.reference=${orgId}&props=name,start_date,end_date,description&limit=200`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) {
		throw new Error(`listSeasons failed: ${res.status}`);
	}
	const body = (await res.json()) as { entities?: SeasonRaw[] };
	return (body.entities ?? [])
		.map(
			(raw): Season => ({
				id: raw._id,
				name: raw.name?.[0]?.string ?? '',
				startDate: raw.start_date?.[0]?.date ?? '',
				endDate: raw.end_date?.[0]?.date ?? '',
				description: raw.description?.[0]?.string,
			}),
		)
		.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function createSeriesWithEvents(
	cfg: EntuCfg,
	input: CreateSeriesInput,
): Promise<CreateSeriesResult> {
	// 1. Create the event_series entity (private; parented to org + season).
	const seriesProps: EntuProp[] = [
		{ type: '_type', reference: TYPE_IDS.event_series },
		{ type: '_sharing', string: 'private' },
		{ type: '_parent', reference: input.orgId },
		{ type: '_parent', reference: input.seasonId },
		{ type: 'event_type', string: 'rehearsal' },
		{ type: 'name', string: input.name },
		{ type: 'interval_days', number: input.intervalDays },
		{ type: 'start_time', string: input.startTime },
		{ type: 'duration_minutes', number: input.durationMinutes },
		{ type: 'start_date', date: input.startDate },
		{ type: 'end_date', date: input.endDate },
	];
	if (input.location !== undefined) {
		seriesProps.push({ type: 'default_location', string: input.location });
	}
	const seriesId = await createEntity(cfg, seriesProps);

	// 2. Eagerly generate one event per occurrence (serial — Entu has no bulk create).
	//    Unset event fields (duration, location) are inherited at read time, never
	//    via formula (spec §3.2) — so we set only the per-occurrence datetime here.
	const dates = occurrenceDates(input.startDate, input.endDate, input.intervalDays);
	const eventIds: string[] = [];
	for (const date of dates) {
		const eventProps: EntuProp[] = [
			{ type: '_type', reference: TYPE_IDS.event },
			{ type: '_sharing', string: 'private' },
			{ type: '_parent', reference: input.orgId },
			{ type: '_parent', reference: input.seasonId },
			{ type: '_parent', reference: seriesId },
			{ type: 'event_type', string: 'rehearsal' },
			{ type: 'name', string: input.name },
			{ type: 'start_datetime', datetime: toStartDatetime(date, input.startTime) },
			{ type: 'duration_minutes', number: input.durationMinutes },
		];
		try {
			eventIds.push(await createEntity(cfg, eventProps));
		} catch (cause) {
			// Best-effort: keep what landed, no rollback (spec §4).
			throw new PartialGenerationError(seriesId, eventIds.length, cause);
		}
	}

	return { seriesId, eventIds };
}

// ── Task 6: listRehearsals ─────────────────────────────────────────────────────

export interface ListRehearsalsInput {
	orgId: string;
	seasonId: string;
}

export async function listRehearsals(
	cfg: EntuCfg,
	input: ListRehearsalsInput,
): Promise<Rehearsal[]> {
	const { orgId, seasonId } = input;
	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=event&event_type.string=rehearsal&_parent.reference=${seasonId}&props=name,event_type,start_datetime,duration_minutes,location,_parent&limit=500`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) {
		throw new Error(`listRehearsals failed: ${res.status}`);
	}
	const body = (await res.json()) as { entities?: RehearsalRaw[] };
	const raws = body.entities ?? [];
	if (raws.length === 0) return [];

	// Identify each event's series parent (the _parent ref that is neither org nor season).
	const seriesIdFor = (raw: RehearsalRaw): string =>
		(raw._parent ?? []).map((p) => p.reference).find((ref) => ref !== orgId && ref !== seasonId) ??
		'';

	// Read-time inheritance merge: fetch each unique parent series ONCE (cache —
	// avoids N+1), then fill event fields that are absent on the event itself.
	// Never a formula (spec §3.2); the explicit event value always wins.
	const seriesCache = new Map<string, SeriesRaw>();
	const uniqueSeriesIds = [...new Set(raws.map(seriesIdFor).filter(Boolean))];
	await Promise.all(
		uniqueSeriesIds.map(async (sid) => {
			const sRes = await fetch(
				`${ENTU_API_BASE}${cfg.db}/entity/${sid}?props=default_location,duration_minutes`,
				{ headers: authHeaders(cfg.token) },
			);
			if (!sRes.ok) return;
			const sBody = (await sRes.json()) as { entity?: SeriesRaw };
			if (sBody.entity) seriesCache.set(sid, sBody.entity);
		}),
	);

	return raws
		.map((raw): Rehearsal => {
			const seriesId = seriesIdFor(raw);
			const series = seriesCache.get(seriesId);
			return {
				id: raw._id,
				seriesId,
				startDatetime: raw.start_datetime?.[0]?.datetime ?? '',
				durationMinutes:
					raw.duration_minutes?.[0]?.number ?? series?.duration_minutes?.[0]?.number ?? 0,
				location: raw.location?.[0]?.string ?? series?.default_location?.[0]?.string,
				name: raw.name?.[0]?.string,
			};
		})
		.sort((a, b) => a.startDatetime.localeCompare(b.startDatetime));
}

// ── Task 7: updateRehearsal ───────────────────────────────────────────────────

/**
 * Patch payload for a single rehearsal. Each field carries both the new value
 * AND the existing property-value `_id` (needed for DELETE-then-POST replace
 * semantics — `project_entu_post_appends_multi_value`).
 */
export interface RehearsalPatch {
	start_datetime?: { valueId: string; value: string };
	duration_minutes?: { valueId: string; value: number };
	location?: { valueId: string | null; value: string };
	description?: { valueId: string | null; value: string };
}

export async function updateRehearsal(
	cfg: EntuCfg,
	eventId: string,
	patch: RehearsalPatch,
): Promise<void> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	// Replace semantics per field: if a value already exists (valueId), DELETE it
	// first, then POST the new value (Entu POST appends — clear-then-set).
	const applyField = async (valueId: string | null, prop: EntuProp): Promise<void> => {
		if (valueId !== null) {
			const delRes = await fetch(`${base}/property/${valueId}`, { method: 'DELETE', headers });
			if (!delRes.ok) throw new Error(`property delete failed: ${delRes.status}`);
		}
		const postRes = await fetch(`${base}/entity/${eventId}`, {
			method: 'POST',
			headers,
			body: JSON.stringify([prop]),
		});
		if (!postRes.ok) throw new Error(`property POST failed: ${postRes.status}`);
	};

	if (patch.start_datetime) {
		await applyField(patch.start_datetime.valueId, {
			type: 'start_datetime',
			datetime: patch.start_datetime.value,
		});
	}
	if (patch.duration_minutes) {
		await applyField(patch.duration_minutes.valueId, {
			type: 'duration_minutes',
			number: patch.duration_minutes.value,
		});
	}
	if (patch.location) {
		await applyField(patch.location.valueId, { type: 'location', string: patch.location.value });
	}
	if (patch.description) {
		await applyField(patch.description.valueId, {
			type: 'description',
			string: patch.description.value,
		});
	}
}

// ── Task 8: deleteRehearsal ───────────────────────────────────────────────────

/** Thrown when Entu returns 403 on a delete (insufficient tier — _owner required). */
export class DeleteForbiddenError extends Error {
	readonly entityId: string;
	constructor(entityId: string) {
		super(`delete forbidden: ${entityId} — _owner tier required`);
		this.name = 'DeleteForbiddenError';
		this.entityId = entityId;
	}
}

export async function deleteRehearsal(cfg: EntuCfg, eventId: string): Promise<void> {
	const res = await fetch(`${ENTU_API_BASE}${cfg.db}/entity/${eventId}`, {
		method: 'DELETE',
		headers: authHeaders(cfg.token),
	});
	if (res.status === 403) throw new DeleteForbiddenError(eventId);
	if (!res.ok) throw new Error(`deleteRehearsal failed: ${res.status}`);
}

// ── Task 9: deleteSeriesCascade ───────────────────────────────────────────────

export interface DeleteCascadeResult {
	deleted: number;
	seriesDeleted: boolean;
}

export async function deleteSeriesCascade(
	cfg: EntuCfg,
	seriesId: string,
): Promise<DeleteCascadeResult> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	// Children search is filtered by THIS series specifically (+ event type), never
	// just the season — guards against sweeping sibling-series events (spec Cap6 step 2).
	const searchRes = await fetch(
		`${base}/entity?_type.string=event&_parent.reference=${seriesId}&props=_id&limit=500`,
		{ headers },
	);
	if (!searchRes.ok) throw new Error(`cascade child search failed: ${searchRes.status}`);
	const searchBody = (await searchRes.json()) as { entities?: Array<{ _id: string }> };
	const children = searchBody.entities ?? [];

	// Serial DELETE (Entu has no bulk delete). Count successes; abort the series
	// delete if any child delete fails (best-effort, no rollback).
	let deleted = 0;
	let allDeleted = true;
	for (const child of children) {
		const delRes = await fetch(`${base}/entity/${child._id}`, { method: 'DELETE', headers });
		if (delRes.ok) deleted++;
		else allDeleted = false;
	}

	let seriesDeleted = false;
	if (allDeleted) {
		const sRes = await fetch(`${base}/entity/${seriesId}`, { method: 'DELETE', headers });
		seriesDeleted = sRes.ok;
	}

	return { deleted, seriesDeleted };
}

// ── Task 10: conductor grant/revoke/list ──────────────────────────────────────

export interface AssignConductorInput {
	seasonId: string;
	orgId: string;
	personId: string;
}

export interface RevokeConductorInput {
	seasonId: string;
	/** The person entity id — all _editor grants for this person on the season are revoked. */
	personId: string;
}

/**
 * Returns the directly-assigned conductors on a season — i.e. `_editor` entries
 * where `property_type === '_editor'` AND `inherited !== true`.
 * P0.3 finding: the `_editor` GET field is a flattened owner+editor view; direct
 * conductor grants have `inherited` ABSENT (not `false`).
 */
export async function listConductors(cfg: EntuCfg, seasonId: string): Promise<Conductor[]> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	const res = await fetch(`${base}/entity/${seasonId}?props=_editor`, { headers });
	if (!res.ok) throw new Error(`listConductors failed: ${res.status}`);
	const body = (await res.json()) as { entity?: SeasonRaw };

	// P0.3: `_editor` GET is a flattened owner+editor rights view. Direct conductor
	// grants are property_type '_editor' with `inherited` ABSENT; cascaded org-owner
	// entries carry `inherited: true`, and a direct _owner is property_type '_owner'.
	const directEditors = (body.entity?._editor ?? []).filter(
		(e) => e.property_type === '_editor' && e.inherited !== true,
	);

	// Single-hop name resolution: one GET /entity/{personId} per conductor (Cap7).
	// Dedupe by personId in case Entu POST appended duplicate _editor grants.
	const seen = new Set<string>();
	const uniqueEditors = directEditors.filter((e) => {
		if (seen.has(e.reference)) return false;
		seen.add(e.reference);
		return true;
	});
	return Promise.all(
		uniqueEditors.map(async (entry): Promise<Conductor> => {
			const pRes = await fetch(`${base}/entity/${entry.reference}?props=name`, { headers });
			const pBody = (await pRes.json()) as { entity?: { name?: Array<{ string: string }> } };
			return {
				personId: entry.reference,
				name: pBody.entity?.name?.[0]?.string ?? '',
			};
		}),
	);
}

/**
 * Grants conductor rights to a person on a season.
 * Throws if the person is not an active org member (membership-pairing gate, spec Cap7).
 */
export async function assignConductor(cfg: EntuCfg, input: AssignConductorInput): Promise<void> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	// Membership-pairing gate (spec Cap7): a conductor must be an active org member.
	const memberRes = await fetch(
		`${base}/entity?_type.string=member&person.reference=${input.personId}&_parent.reference=${input.orgId}&props=_id&limit=1`,
		{ headers },
	);
	if (!memberRes.ok) throw new Error(`member lookup failed: ${memberRes.status}`);
	const memberBody = (await memberRes.json()) as { entities?: Array<{ _id: string }> };
	if ((memberBody.entities ?? []).length === 0) {
		throw new Error(`${input.personId} must be an org member before becoming a conductor`);
	}

	// Idempotent: if the person already holds a direct _editor grant on the season,
	// skip the POST (Entu POST appends, so a re-assign would mint a duplicate grant).
	const seasonRes = await fetch(`${base}/entity/${input.seasonId}?props=_editor`, { headers });
	if (!seasonRes.ok) throw new Error(`season lookup failed: ${seasonRes.status}`);
	const seasonBody = (await seasonRes.json()) as { entity?: SeasonRaw };
	const alreadyGranted = (seasonBody.entity?._editor ?? []).some(
		(e) => e.reference === input.personId && e.property_type === '_editor',
	);
	if (alreadyGranted) return;

	// Grant: roles-as-rights — POST a direct _editor reference on the season.
	const grantRes = await fetch(`${base}/entity/${input.seasonId}`, {
		method: 'POST',
		headers,
		body: JSON.stringify([{ type: '_editor', reference: input.personId }]),
	});
	if (!grantRes.ok) throw new Error(`conductor grant failed: ${grantRes.status}`);
}

/**
 * Revoke a conductor: delete ALL of the person's direct `_editor` grants on the
 * season (`DELETE /property/{id}` per value-id, not `/entity/`). Removing every
 * matching grant cleans up any duplicates; idempotent with assignConductor's
 * check-then-skip.
 */
export async function revokeConductor(cfg: EntuCfg, input: RevokeConductorInput): Promise<void> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	// Read the season's _editor entries, then DELETE every property-VALUE granted to
	// this person (there may be duplicates from the prior double-assign bug). Wire is
	// DELETE /property/{valueId}, NOT /entity/ (project_entu_wire_shape_entity_vs_property).
	const res = await fetch(`${base}/entity/${input.seasonId}?props=_editor`, { headers });
	if (!res.ok) throw new Error(`revokeConductor lookup failed: ${res.status}`);
	const body = (await res.json()) as { entity?: SeasonRaw };
	const grants = (body.entity?._editor ?? []).filter(
		(e) =>
			e.reference === input.personId && e.property_type === '_editor' && typeof e._id === 'string',
	);

	for (const grant of grants) {
		const delRes = await fetch(`${base}/property/${grant._id}`, { method: 'DELETE', headers });
		if (!delRes.ok) throw new Error(`revokeConductor delete failed: ${delRes.status}`);
	}
}

// ── T1: listOrgMembers ────────────────────────────────────────────────────────

/**
 * Returns active org members as `OrgMember[]` for the conductor-picker.
 * Two-fetch pattern (mirrors listConductors): search active members, resolve
 * each person's name via a second GET.
 */
export async function listOrgMembers(cfg: EntuCfg, orgId: string): Promise<OrgMember[]> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	const res = await fetch(
		`${base}/entity?_type.string=member&_parent.reference=${orgId}&status.string=active&props=person&limit=500`,
		{ headers },
	);
	if (!res.ok) throw new Error(`listOrgMembers failed: ${res.status}`);
	const body = (await res.json()) as {
		entities?: Array<{ person?: Array<{ reference: string }> }>;
	};
	const members = body.entities ?? [];
	if (members.length === 0) return [];

	// Resolve each unique person name once (single-hop GET per person — mirrors
	// listConductors). De-dupe personIds so a person attached via multiple member
	// rows isn't fetched twice.
	const personIds = [
		...new Set(members.map((m) => m.person?.[0]?.reference).filter((id): id is string => !!id)),
	];
	return Promise.all(
		personIds.map(async (personId): Promise<OrgMember> => {
			const pRes = await fetch(`${base}/entity/${personId}?props=name`, { headers });
			const pBody = (await pRes.json()) as { entity?: { name?: Array<{ string: string }> } };
			return { personId, name: pBody.entity?.name?.[0]?.string ?? '' };
		}),
	);
}

// ── T3: listSeries ────────────────────────────────────────────────────────────

/**
 * Returns the event_series entities under a season, mapped to RehearsalSeries[].
 * Used by the route to build the seriesNames Map for RehearsalList grouping.
 */
export async function listSeries(cfg: EntuCfg, seasonId: string): Promise<RehearsalSeries[]> {
	const res = await fetch(
		`${ENTU_API_BASE}${cfg.db}/entity?_type.string=event_series&_parent.reference=${seasonId}&props=name,interval_days,start_time,duration_minutes,start_date,end_date&limit=200`,
		{ headers: authHeaders(cfg.token) },
	);
	if (!res.ok) throw new Error(`listSeries failed: ${res.status}`);
	const body = (await res.json()) as { entities?: SeriesRaw[] };
	return (body.entities ?? []).map(
		(raw): RehearsalSeries => ({
			id: raw._id,
			name: raw.name?.[0]?.string ?? '',
			intervalDays: raw.interval_days?.[0]?.number ?? 0,
			startTime: raw.start_time?.[0]?.string ?? '',
			durationMinutes: raw.duration_minutes?.[0]?.number ?? 0,
			startDate: raw.start_date?.[0]?.date ?? '',
			endDate: raw.end_date?.[0]?.date ?? '',
		}),
	);
}

// ── updateSeason (self-resolving clear-then-set) ──────────────────────────────

/**
 * Patch payload for a single season. Only provided fields are updated;
 * absent fields are untouched. Unlike `updateRehearsal`, the caller does NOT
 * need to pass property-value ids — `updateSeason` resolves them itself via
 * a GET on the season entity.
 */
export interface SeasonPatch {
	name?: string;
	startDate?: string;
	endDate?: string;
	description?: string;
}

/**
 * Update a season's fields using self-resolving clear-then-set: GET the
 * current season, resolve existing value-ids for patched fields, DELETE them,
 * then POST the new values. Fields absent from the patch are untouched.
 */
export async function updateSeason(
	cfg: EntuCfg,
	seasonId: string,
	patch: SeasonPatch,
): Promise<void> {
	const headers = authHeaders(cfg.token);
	const base = `${ENTU_API_BASE}${cfg.db}`;

	// Entu property name + value-type per patch key.
	const fieldMap = {
		name: 'name',
		startDate: 'start_date',
		endDate: 'end_date',
		description: 'description',
	} as const;
	const valueTypeMap = {
		name: 'string',
		description: 'string',
		startDate: 'date',
		endDate: 'date',
	} as const;

	const keys = (Object.keys(patch) as Array<keyof SeasonPatch>).filter(
		(k) => patch[k] !== undefined,
	);
	if (keys.length === 0) return; // empty patch — no GET-driven mutation needed

	// Self-resolve: GET the season once to find the existing value-ids to clear.
	const getRes = await fetch(
		`${base}/entity/${seasonId}?props=name,start_date,end_date,description`,
		{ headers },
	);
	if (!getRes.ok) throw new Error(`updateSeason lookup failed: ${getRes.status}`);
	const body = (await getRes.json()) as {
		entity?: Record<string, Array<{ _id: string }> | undefined>;
	};
	const entity = body.entity ?? {};

	// Per-field clear-then-set is best-effort, not transactional: if a field's DELETE
	// lands but its POST then fails, that field is left CLEARED on the season (no
	// rollback). The throw surfaces the failure; a re-hydrate shows the cleared field
	// so the user can re-enter it. Acceptable for this single-editor admin flow.
	for (const key of keys) {
		const prop = fieldMap[key];
		// Clear: DELETE each existing value-id for this property (none → skip, just POST).
		for (const value of entity[prop] ?? []) {
			const delRes = await fetch(`${base}/property/${value._id}`, { method: 'DELETE', headers });
			if (!delRes.ok) throw new Error(`updateSeason delete failed: ${delRes.status}`);
		}
		// Set: POST the new value with the correct value-type key.
		const postRes = await fetch(`${base}/entity/${seasonId}`, {
			method: 'POST',
			headers,
			body: JSON.stringify([{ type: prop, [valueTypeMap[key]]: patch[key] }]),
		});
		if (!postRes.ok) throw new Error(`updateSeason POST failed: ${postRes.status}`);
	}
}

// Re-export types consumed by tests (avoids separate import in spec)
export type { Conductor, OrgMember, Rehearsal, RehearsalRaw, RehearsalSeries, SeriesRaw };
