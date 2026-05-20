import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPhaseBDbState, type PhaseBDbState } from './fetch-db-state';
import type { EntuClient } from './entu-client';

// Gap-2 (RED-2): fetchPhaseBDbState must return populated propertyNames, propertyIds,
// and currentFormulas per type — not the empty-map stub that fetchTypesOnly returned.
// Contract: for each entity type in the db, perform a follow-up GET to fetch its property
// definitions and extract name, id, and formula values.

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt'
};

afterEach(() => {
	vi.restoreAllMocks();
});

// Simulates GET /entity?_type.reference=<meta-type-id>
function mockTypesPage(
	fetchMock: ReturnType<typeof vi.spyOn>,
	types: Array<{ _id: string; name: string }>
) {
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: types.map(t => ({
					_id: t._id,
					name: [{ string: t.name }],
					_type: [{ reference: 'meta-type-entity-id' }]
				})),
				count: types.length
			}),
			{ status: 200 }
		)
	);
}

// Simulates GET /entity?_type.reference=<meta-property-id>&_parent.reference=<type-id>
function mockPropertiesPage(
	fetchMock: ReturnType<typeof vi.spyOn>,
	props: Array<{ _id: string; name: string; formula?: string }>
) {
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: props.map(p => ({
					_id: p._id,
					name: [{ string: p.name }],
					...(p.formula ? { formula: [{ string: p.formula }] } : {})
				})),
				count: props.length
			}),
			{ status: 200 }
		)
	);
}

describe('fetchPhaseBDbState', () => {
	it('returns populated propertyNames per type', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		mockTypesPage(fetchMock, [
			{ _id: 'section-type-id', name: 'section' },
			{ _id: 'org-type-id', name: 'organization' }
		]);
		// section properties
		mockPropertiesPage(fetchMock, [
			{ _id: 'sect-name-prop-id', name: 'name' },
			{ _id: 'sect-ordinal-prop-id', name: 'ordinal' },
			{ _id: 'sect-voice-type-prop-id', name: 'voice_type' }
		]);
		// organization properties
		mockPropertiesPage(fetchMock, [
			{ _id: 'org-name-prop-id', name: 'name' },
			{ _id: 'org-contact-prop-id', name: 'contact_email' }
		]);

		const state: PhaseBDbState = await fetchPhaseBDbState(client);

		expect(state.section.propertyNames).toEqual(
			expect.arrayContaining(['name', 'ordinal', 'voice_type'])
		);
		expect(state.organization.propertyNames).toEqual(
			expect.arrayContaining(['name', 'contact_email'])
		);
	});

	it('returns populated propertyIds per type', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		mockTypesPage(fetchMock, [{ _id: 'section-type-id', name: 'section' }]);
		mockPropertiesPage(fetchMock, [
			{ _id: 'sect-ordinal-prop-id', name: 'ordinal' },
			{ _id: 'sect-voice-type-prop-id', name: 'voice_type' }
		]);

		const state: PhaseBDbState = await fetchPhaseBDbState(client);

		expect(state.section.propertyIds['ordinal']).toBe('sect-ordinal-prop-id');
		expect(state.section.propertyIds['voice_type']).toBe('sect-voice-type-prop-id');
	});

	it('populates currentFormulas for properties that have a formula value', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		mockTypesPage(fetchMock, [{ _id: 'section-type-id', name: 'section' }]);
		mockPropertiesPage(fetchMock, [
			{ _id: 'sect-member-count-id', name: 'member_count', formula: '_child.member COUNT' },
			{ _id: 'sect-name-id', name: 'name' } // no formula
		]);

		const state: PhaseBDbState = await fetchPhaseBDbState(client);

		expect(state.section.currentFormulas['member_count']).toBe('_child.member COUNT');
		expect(state.section.currentFormulas['name']).toBeUndefined();
	});

	it('handles multiple types with per-type property fetches', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		mockTypesPage(fetchMock, [
			{ _id: 'work-type-id', name: 'work' },
			{ _id: 'edition-type-id', name: 'edition' },
			{ _id: 'section-type-id', name: 'section' }
		]);
		// work props
		mockPropertiesPage(fetchMock, [
			{ _id: 'w-voicing-id', name: 'voicing' },
			{ _id: 'w-language-id', name: 'language' }
		]);
		// edition props
		mockPropertiesPage(fetchMock, [
			{ _id: 'e-work-id', name: 'work', formula: '_parent.edition.name CONCAT' }
		]);
		// section props
		mockPropertiesPage(fetchMock, [
			{ _id: 's-ordinal-id', name: 'ordinal' }
		]);

		const state: PhaseBDbState = await fetchPhaseBDbState(client);

		// 3 types present
		expect(Object.keys(state)).toHaveLength(3);
		expect(state.work.propertyNames).toContain('voicing');
		expect(state.edition.currentFormulas['work']).toBe('_parent.edition.name CONCAT');
		expect(state.section.propertyIds['ordinal']).toBe('s-ordinal-id');
	});

	it('makes N+1 fetch calls: 1 for types list + 1 per type for its properties', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		mockTypesPage(fetchMock, [
			{ _id: 't1', name: 'work' },
			{ _id: 't2', name: 'section' }
		]);
		mockPropertiesPage(fetchMock, [{ _id: 'p1', name: 'name' }]);
		mockPropertiesPage(fetchMock, [{ _id: 'p2', name: 'ordinal' }]);

		await fetchPhaseBDbState(client);

		// 1 types-list call + 1 per-type properties call × 2 types = 3 total
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('throws if the types-list fetch fails', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

		await expect(fetchPhaseBDbState(client)).rejects.toThrow(/401/);
	});
});
