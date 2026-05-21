/**
 * Phase C pre-flight probe — read-only
 *
 * Extends Pérotin's session-10 discovery (commit a1aba7a) to capture the
 * concrete IDs and dependency-scan needed before authoring the 5 cleanup
 * scripts. Answers:
 *
 * 1. Formula reference scan — any prop-def formula referencing the 4 retiring
 *    types or member.role? Any hit = HALT.
 * 2. Reference-query picker scan — any reference prop's reference_query targeting
 *    a retiring type? Any hit = HALT.
 * 3. Instance recounts — drift-check from a1aba7a (inventory_copy, participation,
 *    affiliation, member.role).
 * 4. Role-type entity inventory — _id + display name for every role-type instance.
 * 5. Prop-def inventory per retiring type — _id + name per prop-def entity.
 * 6. Type-def entity _ids for all 4 retiring types.
 *
 * Run: pnpm exec tsx scripts/migrations/probes/probe-phase-c-preflight-2026-05-21.ts
 * Auth: read-only; auth-gate NOT required.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  getJwt,
  fetchEntity,
  POLYPHONY_META_TYPE_ENTITY_ID,
  POLYPHONY_META_TYPE_PROPERTY_ID,
} from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
  console.error('ERROR: ENTU_API_KEY env var required');
  process.exit(1);
}

// Known PO member IDs with role values (from session-10 discovery, commit a1aba7a)
const KNOWN_ROLE_MEMBER_IDS = [
  '69c7f8728489bfcb0e81b085', // PO member in EFK
  '69c7f8788489bfcb0e81b1c9', // PO member in Sireen
  '69c7f87e8489bfcb0e81b304', // PO member in Rahvusmeeskoor
  '69c7f8878489bfcb0e81b510', // PO member in TAM
];

// Retiring type names for formula scan
const RETIRING_TYPE_PATTERNS = [
  { name: 'affiliation', regex: /\baffiliation\b/ },
  { name: 'inventory_copy', regex: /\binventory_copy\b/ },
  { name: 'participation', regex: /\bparticipation\b/ },
  { name: 'member.role (formula)', regex: /\bmember\.\*\.role\b/ },
  { name: 'role.*', regex: /\brole\.\*/ },
];

const RETIRING_REFERENCE_QUERY_TYPES = new Set(['inventory_copy', 'participation', 'affiliation', 'role']);

type PropVal = { _id?: string; string?: string; reference?: string; boolean?: boolean; integer?: number; datetime?: string; date?: string; formula?: string };
type AnyEntity = { _id: string; [key: string]: unknown };

async function rawGet(jwt: string, path: string): Promise<unknown> {
  const url = `${API_BASE}/${DB}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllPages(jwt: string, baseQuery: string, limit = 500): Promise<AnyEntity[]> {
  const resp = await rawGet(jwt, `${baseQuery}&limit=${limit}`) as { entities?: AnyEntity[]; count?: number };
  const entities = resp.entities ?? [];
  const total = resp.count ?? entities.length;
  if (total > limit) {
    console.warn(`  WARNING: query total=${total} > limit=${limit}; results truncated`);
  }
  return entities;
}

async function getTypeDefId(jwt: string, typeName: string): Promise<string | null> {
  // Type-def entities: _type.reference=POLYPHONY_META_TYPE_ENTITY_ID, name.string=<typeName>
  const resp = await rawGet(jwt, `entity/?_type.reference=${POLYPHONY_META_TYPE_ENTITY_ID}&name.string=${typeName}&props=_id,name&limit=10`) as { entities?: AnyEntity[] };
  const entities = resp.entities ?? [];
  if (entities.length === 0) return null;
  if (entities.length > 1) console.warn(`  WARNING: multiple type-defs found for "${typeName}": ${entities.map(e => e._id).join(', ')}`);
  return entities[0]._id;
}

async function getPropDefsForType(jwt: string, typeDefId: string): Promise<Array<{ _id: string; name: string; type: string | null; formula: string | null; referenceQuery: unknown }>> {
  // Prop-defs: _type.reference=POLYPHONY_META_TYPE_PROPERTY_ID, _parent.reference=<typeDefId>
  const resp = await rawGet(jwt,
    `entity/?_type.reference=${POLYPHONY_META_TYPE_PROPERTY_ID}&_parent.reference=${typeDefId}&props=_id,name,type,formula,reference_query&limit=200`
  ) as { entities?: AnyEntity[] };
  return (resp.entities ?? []).map(e => ({
    _id: e._id,
    name: ((e.name as PropVal[] | undefined)?.[0]?.string) ?? '(unnamed)',
    type: ((e.type as PropVal[] | undefined)?.[0]?.string) ?? null,
    formula: ((e.formula as PropVal[] | undefined)?.[0]?.string) ?? null,
    referenceQuery: (e.reference_query as PropVal[] | undefined)?.[0]?.string ?? null,
  }));
}

async function main() {
  console.log('Phase C pre-flight probe — read-only');
  console.log(`DB: ${DB}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

  // ── 1. Fetch all prop-defs for formula + reference-query scan ──────────────
  console.log('=== 1. Formula + reference-query scan ===');
  console.log('  Fetching all prop-def entities across all types...');

  // All prop-def entities
  const allPropDefs = await fetchAllPages(
    jwt,
    `entity/?_type.reference=${POLYPHONY_META_TYPE_PROPERTY_ID}&props=_id,name,type,formula,reference_query`,
    2000
  );
  console.log(`  Total prop-defs fetched: ${allPropDefs.length}`);

  const formulaReferences: Array<{ propDefId: string; propName: string; formula: string; matchedPattern: string }> = [];
  const referenceQueryPickers: Array<{ propDefId: string; propName: string; referenceQuery: string; matchedType: string }> = [];

  for (const pd of allPropDefs) {
    const name = ((pd.name as PropVal[] | undefined)?.[0]?.string) ?? '(unnamed)';
    const formulaVal = ((pd.formula as PropVal[] | undefined)?.[0]?.string) ?? null;
    const refQueryVal = ((pd.reference_query as PropVal[] | undefined)?.[0]?.string) ?? null;

    if (formulaVal) {
      for (const { name: patternName, regex } of RETIRING_TYPE_PATTERNS) {
        if (regex.test(formulaVal)) {
          console.log(`  FORMULA HIT: prop-def ${pd._id} "${name}" formula="${formulaVal}" matches /${patternName}/`);
          formulaReferences.push({ propDefId: pd._id, propName: name, formula: formulaVal, matchedPattern: patternName });
        }
      }
    }

    if (refQueryVal) {
      // reference_query is stored as a JSON string; parse and check _type field
      try {
        const parsed = JSON.parse(refQueryVal) as { _type?: string };
        if (parsed._type && RETIRING_REFERENCE_QUERY_TYPES.has(parsed._type)) {
          console.log(`  REF-QUERY HIT: prop-def ${pd._id} "${name}" reference_query._type="${parsed._type}"`);
          referenceQueryPickers.push({ propDefId: pd._id, propName: name, referenceQuery: refQueryVal, matchedType: parsed._type });
        }
      } catch {
        // not JSON or different shape; ignore
      }
    }
  }

  console.log(`  Formula references: ${formulaReferences.length}`);
  console.log(`  Reference-query pickers: ${referenceQueryPickers.length}`);
  const haltCondition = formulaReferences.length > 0 || referenceQueryPickers.length > 0;
  console.log(`  HALT condition: ${haltCondition ? 'YES — STOP' : 'NO — clean to proceed'}`);

  // ── 2. Instance recounts ───────────────────────────────────────────────────
  console.log('\n=== 2. Instance recounts (drift check from a1aba7a) ===');

  const invCopyResp = await rawGet(jwt, 'entity/?_type.string=inventory_copy&props=_id&limit=10') as { entities?: AnyEntity[]; count?: number };
  const invCopyCount = invCopyResp.count ?? (invCopyResp.entities ?? []).length;
  console.log(`  inventory_copy: ${invCopyCount} (expected 0)`);

  const participationResp = await rawGet(jwt, 'entity/?_type.string=participation&props=_id&limit=10') as { entities?: AnyEntity[]; count?: number };
  const participationCount = participationResp.count ?? (participationResp.entities ?? []).length;
  console.log(`  participation: ${participationCount} (expected 0)`);

  const affiliationResp = await rawGet(jwt, 'entity/?_type.string=affiliation&props=_id,_parent,umbrella,joined_at,name&limit=20') as { entities?: AnyEntity[]; count?: number };
  const affiliationInstances = affiliationResp.entities ?? [];
  const affiliationCount = affiliationResp.count ?? affiliationInstances.length;
  console.log(`  affiliation: ${affiliationCount} (expected 4)`);

  // Member role values — fetch all 4 known members
  const memberRoleValues: Record<string, Array<{ _id: string; reference: string; displayName: string }>> = {};
  let totalRoleValues = 0;
  for (const memberId of KNOWN_ROLE_MEMBER_IDS) {
    const member = await fetchEntity({ apiBase: API_BASE, db: DB, jwt }, memberId) as AnyEntity;
    const roleVals = (member.role as PropVal[] | undefined) ?? [];
    const extracted = roleVals
      .filter(v => v._id)
      .map(v => ({ _id: v._id!, reference: v.reference ?? '', displayName: v.string ?? '' }));
    memberRoleValues[memberId] = extracted;
    totalRoleValues += extracted.length;
    console.log(`  member ${memberId}: ${extracted.length} role values — ${extracted.map(v => v.displayName).join(', ')}`);
  }
  console.log(`  Total member role values: ${totalRoleValues} (expected 8)`);

  const driftDetected =
    invCopyCount !== 0 || participationCount !== 0 || affiliationCount !== 4 || totalRoleValues !== 8;
  if (driftDetected) {
    console.log('  DRIFT DETECTED — counts differ from a1aba7a baseline. Investigate before proceeding.');
  } else {
    console.log('  No drift — counts match a1aba7a baseline.');
  }

  // ── 3. Role-type entity inventory ─────────────────────────────────────────
  console.log('\n=== 3. Role-type entity inventory ===');
  const roleInstancesResp = await rawGet(jwt, 'entity/?_type.string=role&props=_id,name&limit=50') as { entities?: AnyEntity[]; count?: number };
  const roleTypeInstances = (roleInstancesResp.entities ?? []).map(e => ({
    _id: e._id,
    displayName: ((e.name as PropVal[] | undefined)?.[0]?.string) ?? '(unnamed)',
  }));
  console.log(`  Role-type instances: ${roleTypeInstances.length}`);
  for (const r of roleTypeInstances) {
    console.log(`    ${r._id}: "${r.displayName}"`);
  }

  // ── 4. Type-def entity IDs ─────────────────────────────────────────────────
  console.log('\n=== 4. Type-def entity IDs ===');
  const typeDefIds: Record<string, string | null> = {};
  for (const typeName of ['inventory_copy', 'participation', 'affiliation', 'role']) {
    const id = await getTypeDefId(jwt, typeName);
    typeDefIds[typeName] = id;
    console.log(`  ${typeName}: ${id ?? '(NOT FOUND)'}`);
  }

  // ── 5. Prop-def inventory per retiring type ────────────────────────────────
  console.log('\n=== 5. Prop-def inventory per retiring type ===');
  const propDefs: Record<string, Array<{ _id: string; name: string; type: string | null; formula: string | null; referenceQuery: unknown }>> = {};

  for (const typeName of ['inventory_copy', 'participation', 'affiliation', 'role']) {
    const typeDefId = typeDefIds[typeName];
    if (!typeDefId) {
      console.log(`  ${typeName}: type-def not found; skipping prop-def scan`);
      propDefs[typeName] = [];
      continue;
    }
    const defs = await getPropDefsForType(jwt, typeDefId);
    propDefs[typeName] = defs;
    console.log(`  ${typeName} (${typeDefId}): ${defs.length} prop-defs`);
    for (const d of defs) {
      console.log(`    ${d._id}: "${d.name}" type=${d.type ?? '?'}`);
    }
  }

  // member.role prop-def: find it by name under the member type-def
  console.log('\n  member.role prop-def:');
  const memberTypeDefId = await getTypeDefId(jwt, 'member');
  console.log(`  member type-def: ${memberTypeDefId ?? '(NOT FOUND)'}`);
  let memberRolePropDef: { _id: string; name: string } | null = null;
  if (memberTypeDefId) {
    const memberPropDefs = await getPropDefsForType(jwt, memberTypeDefId);
    const roleDef = memberPropDefs.find(d => d.name === 'role');
    if (roleDef) {
      memberRolePropDef = { _id: roleDef._id, name: roleDef.name };
      console.log(`    _id: ${roleDef._id} name="${roleDef.name}" type=${roleDef.type}`);
    } else {
      console.log('    NOT FOUND — role prop-def not present on member type');
    }
  }

  // ── Write artifact ──────────────────────────────────────────────────────────
  const artifact = {
    runAt: new Date().toISOString(),
    db: DB,
    haltCondition,
    formulaReferences,
    referenceQueryPickers,
    instanceCounts: {
      inventory_copy: invCopyCount,
      participation: participationCount,
      affiliation: affiliationCount,
      memberRoleValuesTotal: totalRoleValues,
    },
    driftDetected,
    affiliationInstances: affiliationInstances.map(e => ({
      _id: e._id,
      _parent: e._parent,
      umbrella: e.umbrella,
      joined_at: e.joined_at,
      name: e.name,
    })),
    memberRoleValues,
    roleTypeInstances,
    typeDefIds,
    propDefs,
    memberRolePropDef,
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const resultsDir = join(process.cwd(), 'scripts/migrations/seed-results');
  mkdirSync(resultsDir, { recursive: true });
  const artifactPath = join(resultsDir, `probe-phase-c-preflight-${ts}.json`);
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: ${artifactPath}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  if (haltCondition) {
    console.log('HALT — formula or reference-query references to retiring types found. See formulaReferences / referenceQueryPickers in artifact. PO escalation required before Tasks 2-6.');
  } else {
    console.log('GO — no formula references or reference-query pickers blocking.');
  }
  if (driftDetected) {
    console.log('DRIFT — instance counts differ from a1aba7a. Investigate before proceeding.');
  } else {
    console.log('COUNTS STABLE — no drift from a1aba7a.');
  }
  console.log(`Role-type instances: ${roleTypeInstances.length}`);
  console.log(`Type-def IDs: ${JSON.stringify(typeDefIds)}`);
  console.log(`Member role prop-def: ${memberRolePropDef?._id ?? '(not found)'}`);

  if (haltCondition || driftDetected) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
