// Domain types and Entu raw shapes for the rehearsal schedule module.
// P0.3 finding: GET `_editor` is a flattened rights view; direct grants have
// `inherited` ABSENT (undefined); cascaded ones have `inherited: true`.

export interface SeasonRaw {
	_id: string;
	name?: Array<{ string: string }>;
	start_date?: Array<{ date: string }>;
	end_date?: Array<{ date: string }>;
	description?: Array<{ string: string }>;
	_parent?: Array<{ reference: string }>;
	// `_id` is the property-value id needed for revokeConductor (DELETE /property/{_id}).
	_editor?: Array<{ _id?: string; reference: string; property_type?: string; inherited?: boolean }>;
}
export interface Season {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	description?: string;
}

export interface SeriesRaw {
	_id: string;
	name?: Array<{ string: string }>;
	event_type?: Array<{ string: string }>;
	interval_days?: Array<{ number: number }>;
	start_time?: Array<{ string: string }>;
	duration_minutes?: Array<{ number: number }>;
	start_date?: Array<{ date: string }>;
	end_date?: Array<{ date: string }>;
	default_location?: Array<{ string: string }>;
}
export interface RehearsalSeries {
	id: string;
	name: string;
	intervalDays: number;
	startTime: string;
	durationMinutes: number;
	startDate: string;
	endDate: string;
	location?: string;
}

export interface RehearsalRaw {
	_id: string;
	name?: Array<{ string: string }>;
	event_type?: Array<{ string: string }>;
	start_datetime?: Array<{ _id?: string; datetime: string }>;
	duration_minutes?: Array<{ _id?: string; number: number }>;
	location?: Array<{ _id?: string; string: string }>;
	description?: Array<{ _id?: string; string: string }>;
	_parent?: Array<{ reference: string }>;
}
export interface Rehearsal {
	id: string;
	seriesId: string;
	startDatetime: string;
	durationMinutes: number;
	location?: string;
	description?: string;
	name?: string;
}

export interface Conductor {
	personId: string;
	name: string;
	// propertyValueId dropped — revoke now goes by personId (all grants for that person
	// are revoked by GET+filter+DELETE, handling the dedupe case where Entu POST appended
	// multiple _editor grants for the same person).
}

/**
 * A picker-eligible org member (person). Canonical location is here (types.ts);
 * ConductorPanel.svelte re-exports it as a convenience for callers that only
 * import the component, but `entuSeasons.listOrgMembers` uses this authoritative shape.
 */
export interface OrgMember {
	personId: string;
	name: string;
}
