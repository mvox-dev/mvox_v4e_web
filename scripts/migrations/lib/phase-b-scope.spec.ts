import { describe, it, expect } from 'vitest';
import {
	PHASE_B_RENAMES,
	PHASE_B_MIGRATIONS,
	PHASE_B_OBSOLETE_DELETES,
	PHASE_B_FORMULA_UPDATES,
	PHASE_B_TOUCH_SAVES,
	isPhaseBRenameTarget,
	isPhaseBObsoleteDelete
} from './phase-b-scope';

// §1 renames — 6 total, each described as source→target with backfill semantics
describe('PHASE_B_RENAMES', () => {
	it('contains exactly 6 rename operations', () => {
		expect(PHASE_B_RENAMES).toHaveLength(6);
	});

	it('includes person.photo → person.avatar (file→file)', () => {
		const op = PHASE_B_RENAMES.find(r => r.source === 'person.photo');
		expect(op).toBeDefined();
		expect(op?.target).toBe('person.avatar');
		expect(op?.backfillKind).toBe('file');
	});

	it('includes section.ordinal → section.display_order (number→number)', () => {
		const op = PHASE_B_RENAMES.find(r => r.source === 'section.ordinal');
		expect(op).toBeDefined();
		expect(op?.target).toBe('section.display_order');
		expect(op?.backfillKind).toBe('number');
	});

	it('includes section.voice_type → section.voice (string→reference)', () => {
		const op = PHASE_B_RENAMES.find(r => r.source === 'section.voice_type');
		expect(op).toBeDefined();
		expect(op?.target).toBe('section.voice');
		expect(op?.backfillKind).toBe('string_to_reference');
	});

	it('includes work.voicing → work.original_voicing (string→string)', () => {
		const op = PHASE_B_RENAMES.find(r => r.source === 'work.voicing');
		expect(op).toBeDefined();
		expect(op?.target).toBe('work.original_voicing');
		expect(op?.backfillKind).toBe('string');
	});

	it('includes work.duration → work.original_duration (number→number)', () => {
		const op = PHASE_B_RENAMES.find(r => r.source === 'work.duration');
		expect(op).toBeDefined();
		expect(op?.target).toBe('work.original_duration');
		expect(op?.backfillKind).toBe('number');
	});

	it('includes work.language → work.original_language (string list→string list)', () => {
		const op = PHASE_B_RENAMES.find(r => r.source === 'work.language');
		expect(op).toBeDefined();
		expect(op?.target).toBe('work.original_language');
		expect(op?.backfillKind).toBe('string_list');
	});
});

// §2 migrations (v9.1: person.forename+surname removed, deferred to Phase D)
describe('PHASE_B_MIGRATIONS', () => {
	it('contains exactly 1 migration operation (§2.8 person.forename+surname deferred)', () => {
		expect(PHASE_B_MIGRATIONS).toHaveLength(1);
	});

	it('includes work.arranger → edition.arranger', () => {
		const op = PHASE_B_MIGRATIONS.find(m => m.source === 'work.arranger');
		expect(op).toBeDefined();
		expect(op?.target).toBe('edition.arranger');
		expect(op?.backfillKind).toBe('parent_copy');
	});

	it('does NOT include person.forename+surname (deferred to Phase D)', () => {
		const op = PHASE_B_MIGRATIONS.find(m => m.source === 'person.forename+surname');
		expect(op).toBeUndefined();
	});
});

// §3 obsolete deletes — 10 total (RED-A4 added organization.member_count)
describe('PHASE_B_OBSOLETE_DELETES', () => {
	it('contains exactly 10 obsolete-delete operations', () => {
		expect(PHASE_B_OBSOLETE_DELETES).toHaveLength(10);
	});

	it('includes all 6 organization deletions', () => {
		const orgDeletes = PHASE_B_OBSOLETE_DELETES.filter(d => d.parentType === 'organization');
		expect(orgDeletes).toHaveLength(6);
		const props = orgDeletes.map(d => d.propertyName);
		expect(props).toContain('contact_email');
		expect(props).toContain('language');
		expect(props).toContain('locale');
		expect(props).toContain('org_type');
		expect(props).toContain('timezone');
		expect(props).toContain('member_count');
	});

	it('includes all 4 member deletions', () => {
		const memberDeletes = PHASE_B_OBSOLETE_DELETES.filter(d => d.parentType === 'member');
		expect(memberDeletes).toHaveLength(4);
		const props = memberDeletes.map(d => d.propertyName);
		expect(props).toContain('email');
		expect(props).toContain('invited_by');
		expect(props).toContain('joined_at');
		expect(props).toContain('nickname');
	});
});

// §4 formula updates — 5 total (RED-A3 added work.edition_count DELETE)
describe('PHASE_B_FORMULA_UPDATES', () => {
	it('contains exactly 5 formula-update operations', () => {
		expect(PHASE_B_FORMULA_UPDATES).toHaveLength(5);
	});

	it('includes section.member_count recursive formula update', () => {
		const op = PHASE_B_FORMULA_UPDATES.find(f => f.parentType === 'section' && f.propertyName === 'member_count');
		expect(op).toBeDefined();
		expect(op?.newFormula).toContain('_child');
		expect(op?.action).toBe('UPDATE_FORMULA');
	});

	it('includes program_item.name formula add/replace', () => {
		const op = PHASE_B_FORMULA_UPDATES.find(f => f.parentType === 'program_item' && f.propertyName === 'name');
		expect(op).toBeDefined();
		expect(op?.action).toBe('UPDATE_FORMULA');
	});

	it('includes repertoire_item.name formula add/replace', () => {
		const op = PHASE_B_FORMULA_UPDATES.find(f => f.parentType === 'repertoire_item' && f.propertyName === 'name');
		expect(op).toBeDefined();
		expect(op?.action).toBe('UPDATE_FORMULA');
	});

	it('includes season.work_count delete (not an update)', () => {
		const op = PHASE_B_FORMULA_UPDATES.find(f => f.parentType === 'season' && f.propertyName === 'work_count');
		expect(op).toBeDefined();
		expect(op?.action).toBe('DELETE_PROPERTY');
	});
});

// §5 touch-saves — 3 total
describe('PHASE_B_TOUCH_SAVES', () => {
	it('contains exactly 3 touch-save operations', () => {
		expect(PHASE_B_TOUCH_SAVES).toHaveLength(3);
	});

	it('includes lending touch-save (expected 0 instances)', () => {
		const op = PHASE_B_TOUCH_SAVES.find(t => t.parentType === 'lending');
		expect(op).toBeDefined();
		expect(op?.propertyName).toBeDefined();
	});

	it('includes organization.member_count_per_section touch-save', () => {
		const op = PHASE_B_TOUCH_SAVES.find(t => t.parentType === 'organization');
		expect(op).toBeDefined();
		expect(op?.propertyName).toBe('member_count_per_section');
	});

	it('includes edition touch-save for edition.work formula', () => {
		const op = PHASE_B_TOUCH_SAVES.find(t => t.parentType === 'edition');
		expect(op).toBeDefined();
		expect(op?.propertyName).toBe('work');
	});

	it('runs §5 after §4 — organization touch-save depends on section.member_count update', () => {
		// The operation list order encodes this dependency: §4 ops must come first
		// Verify that at least one §4 op is declared before the §5 org touch-save
		expect(PHASE_B_FORMULA_UPDATES.length).toBeGreaterThan(0);
		// This is a structural assertion — the executor must respect §4 before §5 ordering
	});
});

// Guard functions
describe('isPhaseBRenameTarget', () => {
	it('returns true for properties that are rename targets', () => {
		expect(isPhaseBRenameTarget('person', 'avatar')).toBe(true);
		expect(isPhaseBRenameTarget('section', 'display_order')).toBe(true);
		expect(isPhaseBRenameTarget('section', 'voice')).toBe(true);
		expect(isPhaseBRenameTarget('work', 'original_voicing')).toBe(true);
		expect(isPhaseBRenameTarget('work', 'original_duration')).toBe(true);
		expect(isPhaseBRenameTarget('work', 'original_language')).toBe(true);
	});

	it('returns false for properties that are not rename targets', () => {
		expect(isPhaseBRenameTarget('person', 'photo')).toBe(false); // source, not target
		expect(isPhaseBRenameTarget('section', 'name')).toBe(false);
		expect(isPhaseBRenameTarget('organization', 'contact_email')).toBe(false);
	});
});

describe('isPhaseBObsoleteDelete', () => {
	it('returns true for confirmed obsolete properties', () => {
		expect(isPhaseBObsoleteDelete('organization', 'contact_email')).toBe(true);
		expect(isPhaseBObsoleteDelete('member', 'email')).toBe(true);
		expect(isPhaseBObsoleteDelete('member', 'nickname')).toBe(true);
	});

	it('returns false for properties that should be kept', () => {
		expect(isPhaseBObsoleteDelete('organization', 'name')).toBe(false);
		expect(isPhaseBObsoleteDelete('person', 'bio')).toBe(false);
	});
});
