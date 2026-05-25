// src/lib/library/hydrateLibrary.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hydrateLibrary } from './hydrateLibrary';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'test-env-db' }));

const TOKEN = 'fake.jwt.token';
const ORG_ID = '69c7f8718489bfcb0e81b065'; // EFK
const PERSON_ID = '69bcfd8e9c031ab8e6ce8079'; // PO
const LIBRARY_ID = '6a12036c4ff8277cd4306b26';

function makeLibraryResponse(opts: { editors: string[] }) {
	return {
		entities: [
			{
				_id: LIBRARY_ID,
				name: [{ string: 'EFK Library' }],
				_parent: [{ reference: ORG_ID }],
				_editor: opts.editors.map((r) => ({ reference: r })),
			},
		],
	};
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.stubGlobal('fetch', vi.fn());
});

describe('hydrateLibrary', () => {
	it('returns no-rights when the org has no library entity', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ entities: [] }), // no library
		});
		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('no-rights');
	});

	it('returns no-rights when the user is not _editor on the library', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => makeLibraryResponse({ editors: ['other-person-id'] }),
		});
		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('no-rights');
	});

	it('returns empty when library exists, user is editor, but 0 works', async () => {
		(globalThis.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeLibraryResponse({ editors: [PERSON_ID] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ entities: [] }), // 0 works
			});
		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('empty');
		if (result.status === 'empty') {
			expect(result.library.id).toBe(LIBRARY_ID);
		}
	});
});

function makeWorksResponse(works: Array<{ id: string; composer: string; title: string }>) {
	return {
		entities: works.map((w) => ({
			_id: w.id,
			_parent: [{ reference: LIBRARY_ID }],
			name: [{ string: w.title }],
			composer: [{ string: w.composer }],
			voicing: [{ string: 'SATB' }],
			language: [{ string: 'Latin' }],
			year: [{ number: 1947 }],
		})),
	};
}

describe('hydrateLibrary — works mapping', () => {
	it('returns ready with mapped works when library has entries', async () => {
		(globalThis.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeLibraryResponse({ editors: [PERSON_ID] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () =>
					makeWorksResponse([
						{ id: 'work-a', composer: 'Duruflé', title: 'Requiem' },
						{ id: 'work-b', composer: 'Pärt', title: 'Da pacem' },
					]),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ entities: [] }), // editions placeholder for work-a
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ entities: [] }), // editions placeholder for work-b
			});

		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('ready');
		if (result.status === 'ready') {
			expect(result.works).toHaveLength(2);
			expect(result.works[0]).toMatchObject({
				id: 'work-a',
				composer: 'Duruflé',
				title: 'Requiem',
			});
		}
	});
});

describe('hydrateLibrary — editions grouped by work', () => {
	it('returns editionsByWork map populated from per-work editions fetch (strategy b)', async () => {
		(globalThis.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeLibraryResponse({ editors: [PERSON_ID] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () =>
					makeWorksResponse([{ id: 'work-a', composer: 'Duruflé', title: 'Requiem' }]),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'ed-1',
							_parent: [{ reference: 'work-a' }],
							name: [{ string: 'Peters · full score' }],
							year: [{ number: 1991 }],
							license_note: [{ string: 'EP-8421' }],
							publisher: [{ string: 'Peters' }],
						},
						{
							_id: 'ed-2',
							_parent: [{ reference: 'work-a' }],
							name: [{ string: 'Durand · organ reduction' }],
							year: [{ number: 1948 }],
							license_note: [{ string: 'DUR-992' }],
						},
					],
				}),
			});

		const result = await hydrateLibrary({ orgId: ORG_ID, personId: PERSON_ID, token: TOKEN });
		expect(result.status).toBe('ready');
		if (result.status === 'ready') {
			const editionsForA = result.editionsByWork.get('work-a');
			expect(editionsForA).toHaveLength(2);
			expect(editionsForA?.[0]).toMatchObject({
				id: 'ed-1',
				workId: 'work-a',
				label: 'Peters · full score',
				year: 1991,
				isbn: 'EP-8421',
			});
		}
	});
});
