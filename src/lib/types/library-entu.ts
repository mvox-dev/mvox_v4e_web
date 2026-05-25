/**
 * Live v4E entity shapes for the library subtree.
 * Distinct from the mock UI shapes in src/lib/types/library.ts which
 * back the 3 task stacks (Returns / Overdue / Pull) and stay on mock
 * data for this CHORE.
 */

export interface EntuLibrary {
	id: string; // _id of the library entity
	name: string; // name[0].string
	orgId: string; // _parent.reference (the org the library belongs to)
	editorIds: string[]; // _editor.*.reference — list of personIds with editor rights
}

export interface EntuWork {
	id: string;
	libraryId: string; // _parent.reference (the library)
	composer: string;
	title: string;
	voicing?: string;
	language?: string;
	year?: number;
}

export interface EntuEdition {
	id: string;
	workId: string; // _parent.reference of the edition (the work entity _id) — strategy (b) per Pérotin probe 6a248b9
	label: string; // name[0].string
	year?: number;
	publisher?: string;
	isbn?: string; // Sourced from license_note[0].string on real entities (Pérotin verdict: no `isbn` key in v4E); undefined when not present
}
