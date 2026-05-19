import { describe, it, expect } from 'vitest';
import { PHASE_A_PROPERTY_ADDITIONS, isInPhaseAScope } from './phase-a-scope';

describe('PHASE_A_PROPERTY_ADDITIONS', () => {
	it('contains the 33 properties from divergence §4.2 (excluding section.member_count formula-update)', () => {
		// Count total entries across all parent types
		let total = 0;
		for (const props of Object.values(PHASE_A_PROPERTY_ADDITIONS)) {
			total += props.size;
		}
		expect(total).toBe(33);
	});

	it('includes confirmed §4.2 entries', () => {
		expect(PHASE_A_PROPERTY_ADDITIONS.edition?.has('external_link')).toBe(true);
		expect(PHASE_A_PROPERTY_ADDITIONS.edition?.has('work')).toBe(true);
		expect(PHASE_A_PROPERTY_ADDITIONS.season?.has('end_date')).toBe(true);
		expect(PHASE_A_PROPERTY_ADDITIONS.organization?.has('social_links')).toBe(true);
		expect(PHASE_A_PROPERTY_ADDITIONS.organization?.has('public_contact')).toBe(true);
	});

	it('excludes Phase B renames', () => {
		expect(PHASE_A_PROPERTY_ADDITIONS.person?.has('avatar') ?? false).toBe(false);
		expect(PHASE_A_PROPERTY_ADDITIONS.section?.has('voice') ?? false).toBe(false);
		expect(PHASE_A_PROPERTY_ADDITIONS.section?.has('display_order') ?? false).toBe(false);
		expect(PHASE_A_PROPERTY_ADDITIONS.work?.has('original_voicing') ?? false).toBe(false);
		expect(PHASE_A_PROPERTY_ADDITIONS.work?.has('original_duration') ?? false).toBe(false);
		expect(PHASE_A_PROPERTY_ADDITIONS.work?.has('original_language') ?? false).toBe(false);
	});

	it('excludes Phase D rights flags', () => {
		expect(PHASE_A_PROPERTY_ADDITIONS.organization?.has('_inheritrights') ?? false).toBe(false);
	});

	it('excludes the section.member_count formula-update (Phase B)', () => {
		expect(PHASE_A_PROPERTY_ADDITIONS.section?.has('member_count') ?? false).toBe(false);
	});
});

describe('isInPhaseAScope', () => {
	it('returns true for properties in §4.2', () => {
		expect(isInPhaseAScope('season', 'end_date')).toBe(true);
		expect(isInPhaseAScope('organization', 'social_links')).toBe(true);
	});

	it('returns false for Phase B/C/D properties', () => {
		expect(isInPhaseAScope('person', 'avatar')).toBe(false);
		expect(isInPhaseAScope('organization', '_inheritrights')).toBe(false);
		expect(isInPhaseAScope('section', 'member_count')).toBe(false);
	});

	it('returns false for unknown parent types', () => {
		expect(isInPhaseAScope('nonexistent_type', 'any_prop')).toBe(false);
	});
});
