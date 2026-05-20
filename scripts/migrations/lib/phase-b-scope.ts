export type BackfillKind = 'file' | 'string' | 'number' | 'string_list' | 'string_to_reference' | 'parent_copy';

export interface PhaseBRenameOp {
	source: string;
	target: string;
	backfillKind: BackfillKind;
}

export interface PhaseBMigrationOp {
	source: string;
	target?: string;
	backfillKind?: BackfillKind;
	action?: 'verify_then_delete';
}

export interface PhaseBObsoleteDeleteOp {
	parentType: string;
	propertyName: string;
}

export interface PhaseBFormulaUpdateOp {
	parentType: string;
	propertyName: string;
	action: 'UPDATE_FORMULA' | 'DELETE_PROPERTY';
	newFormula?: string;
}

export interface PhaseBTouchSaveOp {
	parentType: string;
	propertyName: string;
	formulaExpression: string;
}

export const PHASE_B_RENAMES: PhaseBRenameOp[] = [
	{ source: 'person.photo', target: 'person.avatar', backfillKind: 'file' },
	{ source: 'section.ordinal', target: 'section.display_order', backfillKind: 'number' },
	{ source: 'section.voice_type', target: 'section.voice', backfillKind: 'string_to_reference' },
	{ source: 'work.voicing', target: 'work.original_voicing', backfillKind: 'string' },
	{ source: 'work.duration', target: 'work.original_duration', backfillKind: 'number' },
	{ source: 'work.language', target: 'work.original_language', backfillKind: 'string_list' }
];

// §2.8 person.forename+surname verify_then_delete deferred to Phase D (PO decision 2026-05-20).
// Q5 probe established that POSTing forename/surname after deletion would freeze whitespace-only
// materialized names. Keeping forename+surname as editable source-of-truth ships 95% of Phase B's
// plan; the formula `person.name` remains a useful read-view.
export const PHASE_B_MIGRATIONS: PhaseBMigrationOp[] = [
	{ source: 'work.arranger', target: 'edition.arranger', backfillKind: 'parent_copy' }
];

export const PHASE_B_OBSOLETE_DELETES: PhaseBObsoleteDeleteOp[] = [
	{ parentType: 'organization', propertyName: 'contact_email' },
	{ parentType: 'organization', propertyName: 'language' },
	{ parentType: 'organization', propertyName: 'locale' },
	{ parentType: 'organization', propertyName: 'org_type' },
	{ parentType: 'organization', propertyName: 'timezone' },
	{ parentType: 'organization', propertyName: 'member_count' },
	{ parentType: 'member', propertyName: 'email' },
	{ parentType: 'member', propertyName: 'invited_by' },
	{ parentType: 'member', propertyName: 'joined_at' },
	{ parentType: 'member', propertyName: 'nickname' }
];

export const PHASE_B_FORMULA_UPDATES: PhaseBFormulaUpdateOp[] = [
	{
		parentType: 'section',
		propertyName: 'member_count',
		action: 'UPDATE_FORMULA',
		newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
	},
	{
		parentType: 'program_item',
		propertyName: 'name',
		action: 'UPDATE_FORMULA',
		newFormula: 'edition.*.work CONCAT'
	},
	{
		parentType: 'repertoire_item',
		propertyName: 'name',
		action: 'UPDATE_FORMULA',
		newFormula: 'work.*.name CONCAT'
	},
	{
		parentType: 'season',
		propertyName: 'work_count',
		action: 'DELETE_PROPERTY'
	},
	{
		parentType: 'work',
		propertyName: 'edition_count',
		action: 'DELETE_PROPERTY'
	}
];

export const PHASE_B_TOUCH_SAVES: PhaseBTouchSaveOp[] = [
	{
		parentType: 'lending',
		propertyName: 'name',
		formulaExpression: "member.*.name copy.*.name ' — ' CONCAT_WS"
	},
	{
		parentType: 'organization',
		propertyName: 'member_count_per_section',
		formulaExpression: '(_child.member COUNT) (_child.section.member_count SUM) +'
	},
	{
		parentType: 'edition',
		propertyName: 'work',
		formulaExpression: '_parent'
	}
];

const RENAME_TARGETS: Set<string> = new Set(
	PHASE_B_RENAMES.map((r) => r.target)
);

export function isPhaseBRenameTarget(parentType: string, propertyName: string): boolean {
	return RENAME_TARGETS.has(`${parentType}.${propertyName}`);
}

const OBSOLETE_DELETE_KEYS: Set<string> = new Set(
	PHASE_B_OBSOLETE_DELETES.map((d) => `${d.parentType}.${d.propertyName}`)
);

export function isPhaseBObsoleteDelete(parentType: string, propertyName: string): boolean {
	return OBSOLETE_DELETE_KEYS.has(`${parentType}.${propertyName}`);
}
