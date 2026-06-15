// Per-type `_inheritrights` lookup — the schema's declared `inheritsRights` value for
// each v4E entity type (source: entu/research docs/schema/v4E/schema.ts).
//
// WHY this is needed at create time: Entu only auto-writes `_inheritrights` on a new
// entity when its parent ALREADY has `_inheritrights: true`. `organization` is the one
// type declared `inheritsRights: false` (a rights island), so any entity created DIRECTLY
// under an org is born with `_inheritrights` ABSENT (= false = non-inheriting) unless the
// create explicitly sets it. To be correct by construction, every create helper appends
// `_inheritrightsProp(type)` so the value matches the schema regardless of parent.
//
// All v4E types are `inheritsRights: true` EXCEPT `organization` (false). Unknown types
// default to `true` (the common case); add an entry here when introducing a new type.

const INHERITS_RIGHTS: Record<string, boolean> = {
	organization: false,
	// everything else is true (schema default for the rest of v4E):
	person: true,
	section: true,
	member: true,
	library: true,
	work: true,
	edition: true,
	copy: true,
	lending: true,
	invitation: true,
	application: true,
	season: true,
	event_series: true,
	event: true,
	repertoire_item: true,
	program_item: true,
	rsvp: true,
	attendance: true,
	voice: true,
};

/** The schema's `inheritsRights` value for a type (defaults to `true` for unknown types). */
export function inheritsRights(typeName: string): boolean {
	return INHERITS_RIGHTS[typeName] ?? true;
}

/** The `_inheritrights` create-prop for a type, ready to append to an entity-create body. */
export function inheritRightsProp(typeName: string): { type: '_inheritrights'; boolean: boolean } {
	return { type: '_inheritrights', boolean: inheritsRights(typeName) };
}
