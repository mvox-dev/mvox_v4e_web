/**
 * Phase D post-execution audit — org rights cascade + YELLOW-D4 type default
 *
 * Two questions:
 *  1. Post-_inheritrights=false flip: enumerate _owner/_editor/_viewer grants on
 *     each of the 6 org instances and their immediate subtree (sections + members).
 *     Confirm nothing is severed or orphaned.
 *  2. YELLOW-D4: does the organization TYPE entity have _inheritrights:false set
 *     as the type-level default? If yes → new instances inherit correctly.
 *     If no/unset → every new org will need a manual flip.
 *
 * This is a READ-ONLY probe. No mutations.
 *
 * Run: npx tsx scripts/migrations/probes/probe-phase-d-rights-audit-2026-05-21.ts
 */

import {
	getJwt,
	fetchEntity,
	listEntities,
	listInstancesByType,
	type EntuClient,
} from '../lib/entu-client.js';
import { writeResultArtifact } from '../perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? process.env.ENTU_DATABASE ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

// Known org IDs from Phase D discovery probe
const ORG_IDS: Record<string, string> = {
	EKBL: '69c7f8718489bfcb0e81b05a',
	EFK: '69c7f8718489bfcb0e81b065',
	Sireen: '69c7f8788489bfcb0e81b1a9',
	EMKL: '69c7f87d8489bfcb0e81b2d9',
	Rahvusmeeskoor: '69c7f87d8489bfcb0e81b2e4',
	TAM: '69c7f8868489bfcb0e81b4f0',
};

type RightsEntry = { _id?: string; reference?: string; string?: string };

function extractRights(entity: Record<string, unknown>): {
	owner: RightsEntry[];
	editor: RightsEntry[];
	viewer: RightsEntry[];
	inheritRights: boolean | null;
} {
	const pick = (key: string): RightsEntry[] => {
		const val = entity[key];
		if (!Array.isArray(val)) return [];
		return val as RightsEntry[];
	};
	const ir = entity['_inheritrights'];
	let inheritRights: boolean | null = null;
	if (Array.isArray(ir) && ir.length > 0) {
		inheritRights = (ir[0] as { boolean?: boolean }).boolean ?? null;
	}
	return {
		owner: pick('_owner'),
		editor: pick('_editor'),
		viewer: pick('_viewer'),
		inheritRights,
	};
}

// ─── Part 1: Org instance rights + immediate subtree ──────────────────────

console.log('\n=== Part 1: Org rights + immediate subtree ===');

type OrgAuditRow = {
	orgName: string;
	orgId: string;
	inheritRights: boolean | null;
	orgOwners: number;
	orgEditors: number;
	orgViewers: number;
	sections: Array<{
		sectionId: string;
		sectionName: string;
		inheritRights: boolean | null;
		owners: number;
		editors: number;
		viewers: number;
	}>;
	memberSample: Array<{
		memberId: string;
		inheritRights: boolean | null;
		owners: number;
		editors: number;
		viewers: number;
	}>;
	memberCount: number;
};

const auditRows: OrgAuditRow[] = [];

for (const [orgName, orgId] of Object.entries(ORG_IDS)) {
	console.log(`\nOrg: ${orgName} (${orgId})`);
	const orgEntity = await fetchEntity(client, orgId);
	const orgRights = extractRights(orgEntity);
	console.log(`  _inheritrights: ${orgRights.inheritRights}`);
	console.log(
		`  _owner: ${orgRights.owner.length}, _editor: ${orgRights.editor.length}, _viewer: ${orgRights.viewer.length}`,
	);

	// Sections: immediate children with _type.string=section
	const sectionsResp = await listEntities(client, {
		'_parent.reference': orgId,
		'_type.string': 'section',
		props: '_inheritrights,_owner,_editor,_viewer,name',
		limit: '50',
	});
	console.log(`  Sections: ${sectionsResp.entities.length}`);

	const sectionRows: OrgAuditRow['sections'] = [];
	for (const sec of sectionsResp.entities) {
		const sr = extractRights(sec);
		const nameArr = sec['name'] as Array<{ string?: string }> | undefined;
		const secName = nameArr?.[0]?.string ?? sec._id;
		sectionRows.push({
			sectionId: sec._id,
			sectionName: secName,
			inheritRights: sr.inheritRights,
			owners: sr.owner.length,
			editors: sr.editor.length,
			viewers: sr.viewer.length,
		});
		console.log(
			`    section "${secName}": _inheritrights=${sr.inheritRights}, owners=${sr.owner.length}, editors=${sr.editor.length}, viewers=${sr.viewer.length}`,
		);
	}

	// Members: children with _type.string=member (sample first 10)
	const membersResp = await listEntities(client, {
		'_parent.reference': orgId,
		'_type.string': 'member',
		props: '_inheritrights,_owner,_editor,_viewer',
		limit: '10',
	});
	console.log(`  Members (sample up to 10): ${membersResp.entities.length} returned`);

	const memberRows: OrgAuditRow['memberSample'] = [];
	for (const mem of membersResp.entities) {
		const mr = extractRights(mem);
		memberRows.push({
			memberId: mem._id,
			inheritRights: mr.inheritRights,
			owners: mr.owner.length,
			editors: mr.editor.length,
			viewers: mr.viewer.length,
		});
	}

	// Full member count
	const membersCountResp = await listEntities(client, {
		'_parent.reference': orgId,
		'_type.string': 'member',
		props: '_id',
		limit: '500',
	});

	auditRows.push({
		orgName,
		orgId,
		inheritRights: orgRights.inheritRights,
		orgOwners: orgRights.owner.length,
		orgEditors: orgRights.editor.length,
		orgViewers: orgRights.viewer.length,
		sections: sectionRows,
		memberSample: memberRows,
		memberCount: membersCountResp.count ?? membersCountResp.entities.length,
	});
}

// ─── Part 2: YELLOW-D4 — organization TYPE default ─────────────────────────

console.log('\n=== Part 2: YELLOW-D4 — organization TYPE _inheritrights default ===');

// Find the organization type entity. It lives in the meta-types layer.
// Strategy: list entities where _type.reference=META_TYPE_ENTITY_ID and name.string=organization
const META_TYPE_ENTITY_ID = '69bcfd8e9c031ab8e6ce8034';
const orgTypeResp = await listEntities(client, {
	'_type.reference': META_TYPE_ENTITY_ID,
	'name.string': 'organization',
	props: '_inheritrights,name,_id',
	limit: '5',
});

console.log(`  organization type entities found: ${orgTypeResp.entities.length}`);

type TypeAudit = {
	typeEntityId: string | null;
	inheritsRightsDefault: boolean | null;
	raw: unknown;
};
let typeAudit: TypeAudit = { typeEntityId: null, inheritsRightsDefault: null, raw: null };

if (orgTypeResp.entities.length > 0) {
	const orgType = orgTypeResp.entities[0];
	const tr = extractRights(orgType);
	console.log(`  org type _id: ${orgType._id}`);
	console.log(`  org type _inheritrights: ${tr.inheritRights}`);
	typeAudit = {
		typeEntityId: orgType._id,
		inheritsRightsDefault: tr.inheritRights,
		raw: orgType,
	};
} else {
	console.log('  WARNING: organization type entity not found via name.string query');
	// Fallback: try via POLYPHONY_META_TYPE_ENTITY_ID + _type.string=organization
	const fallback = await listEntities(client, {
		'_type.string': 'organization',
		props: '_inheritrights,name',
		limit: '1',
	});
	console.log(`  Fallback (instance check): ${fallback.entities.length} org instances`);
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log('\n=== Summary ===');
for (const row of auditRows) {
	const ok = row.inheritRights === false ? 'OK' : 'WARN';
	console.log(
		`[${ok}] ${row.orgName}: inheritRights=${row.inheritRights}, owners=${row.orgOwners}, editors=${row.orgEditors}, viewers=${row.orgViewers}, sections=${row.sections.length}, members=${row.memberCount}`,
	);
}
console.log(`\nYELLOW-D4 — org TYPE _inheritrights default: ${typeAudit.inheritsRightsDefault}`);
if (typeAudit.inheritsRightsDefault === false) {
	console.log('  STATUS: CORRECT — new org instances will inherit false by default');
} else {
	console.log(
		'  STATUS: NEEDS FIX — new org instances will NOT inherit false; manual flip required for each new org',
	);
}

const artifact = await writeResultArtifact('probe-phase-d-rights-audit-2026-05-21', {
	auditRows,
	typeAudit,
	summary: {
		allOrgsInheritRightsFalse: auditRows.every((r) => r.inheritRights === false),
		orgTypeDefaultCorrect: typeAudit.inheritsRightsDefault === false,
	},
});
console.log(`\nArtifact: ${artifact}`);
