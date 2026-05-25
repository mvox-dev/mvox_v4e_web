// src/lib/library/hydrateLibrary.ts
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { ENTU_API_BASE } from '$lib/entu-config';
import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';

export type LibraryHydrationResult =
	| { status: 'no-rights' }
	| { status: 'empty'; library: EntuLibrary }
	| {
			status: 'ready';
			library: EntuLibrary;
			works: EntuWork[];
			editionsByWork: Map<string, EntuEdition[]>;
	  }
	| { status: 'error'; reason: string };

interface HydrateArgs {
	orgId: string;
	personId: string;
	token: string;
}

interface EntuLibraryRaw {
	_id: string;
	name?: Array<{ string: string }>;
	_parent?: Array<{ reference: string }>;
	_editor?: Array<{ reference: string }>;
}

export async function hydrateLibrary(args: HydrateArgs): Promise<LibraryHydrationResult> {
	const { orgId, personId, token } = args;
	const headers = { Authorization: `Bearer ${token}` };
	const base = `${ENTU_API_BASE}${PUBLIC_ENTU_DB}`;

	// 1. Resolve library entity
	const libRes = await fetch(
		`${base}/entity?_type.string=library&_parent.reference=${orgId}&props=name,_editor,_parent`,
		{ headers },
	);
	if (!libRes.ok) return { status: 'error', reason: `library fetch ${libRes.status}` };
	const libBody = (await libRes.json()) as { entities?: EntuLibraryRaw[] };
	const libRaw = libBody.entities?.[0];
	if (!libRaw) return { status: 'no-rights' };

	const editorIds = (libRaw._editor ?? []).map((e) => e.reference);
	if (!editorIds.includes(personId)) {
		return { status: 'no-rights' };
	}

	const library: EntuLibrary = {
		id: libRaw._id,
		name: libRaw.name?.[0]?.string ?? '',
		orgId: libRaw._parent?.[0]?.reference ?? orgId,
		editorIds,
	};

	// 2. Query works under library
	const worksRes = await fetch(
		`${base}/entity?_type.string=work&_parent.reference=${library.id}&props=name,composer,voicing,language,year&limit=200`,
		{ headers },
	);
	if (!worksRes.ok) return { status: 'error', reason: `works fetch ${worksRes.status}` };
	const worksBody = (await worksRes.json()) as { entities?: any[] };
	const worksRaw = worksBody.entities ?? [];

	if (worksRaw.length === 0) {
		return { status: 'empty', library };
	}

	const works: EntuWork[] = worksRaw
		.map(
			(w): EntuWork => ({
				id: w._id,
				libraryId: library.id,
				composer: w.composer?.[0]?.string ?? '',
				title: w.name?.[0]?.string ?? '',
				voicing: w.voicing?.[0]?.string,
				language: w.language?.[0]?.string,
				year: w.year?.[0]?.number,
			}),
		)
		.sort((a, b) => a.composer.localeCompare(b.composer));

	// 3. Query editions per work (strategy b — Pérotin probe 6a248b9)
	const edPromises = works.map((w) =>
		fetch(
			`${base}/entity?_type.string=edition&_parent.reference=${w.id}&props=name,year,publisher,license_note&limit=50`,
			{ headers },
		)
			.then((r) => (r.ok ? r.json() : { entities: [] }))
			.then((body: { entities?: any[] }) => ({ workId: w.id, raws: body.entities ?? [] })),
	);
	const edResults = await Promise.all(edPromises);
	const editionsByWork = new Map<string, EntuEdition[]>();
	edResults.forEach(({ workId, raws }) => {
		editionsByWork.set(
			workId,
			raws.map(
				(e): EntuEdition => ({
					id: e._id,
					workId,
					label: e.name?.[0]?.string ?? '',
					year: e.year?.[0]?.number,
					publisher: e.publisher?.[0]?.string,
					isbn: e.license_note?.[0]?.string,
				}),
			),
		);
	});

	return { status: 'ready', library, works, editionsByWork };
}
