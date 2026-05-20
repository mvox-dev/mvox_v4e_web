export const PHASE_A_PROPERTY_ADDITIONS: Record<string, Set<string>> = {
	edition: new Set([
		'external_link',
		'work',
		'arranger',
		'voicing',
		'duration',
		'language',
		'acquired_at',
		'source',
		'cost',
		'license_note'
	]),
	event: new Set(['start_datetime', 'duration_minutes', 'description', 'capacity']),
	member: new Set(['status', 'current_section']),
	organization: new Set([
		'founded',
		'location',
		'website',
		'logo',
		'social_links',
		'public_contact',
		'rsvp_lockout_hours',
		'member_count_per_section'
	]),
	person: new Set(['bio', 'preferred_contact_email', 'preferences']),
	program_item: new Set(['notes']),
	repertoire_item: new Set(['status']),
	season: new Set(['end_date', 'description']),
	section: new Set(['description']),
	work: new Set(['catalog_id', 'catalog_system', 'part_of'])
};

export function isInPhaseAScope(parentType: string, propertyName: string): boolean {
	return PHASE_A_PROPERTY_ADDITIONS[parentType]?.has(propertyName) ?? false;
}

export const PHASE_A_NEW_TYPES: Set<string> = new Set([
	'voice',
	'library',
	'copy',
	'lending',
	'invitation',
	'application',
	'event_series',
	'rsvp',
	'attendance'
]);

export function isPhaseANewType(typeName: string): boolean {
	return PHASE_A_NEW_TYPES.has(typeName);
}
