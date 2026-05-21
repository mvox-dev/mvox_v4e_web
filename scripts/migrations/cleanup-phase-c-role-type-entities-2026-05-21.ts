/**
 * Phase C.5 — cleanup-phase-c-role-type-entities
 *
 * Deletes the 5 role-type instance entities (Owner, Admin, Librarian,
 * Conductor, Section Leader), then retires all prop-defs and the type-def
 * for the `role` type.
 *
 * Cross-script gate (live only): re-verifies that member.role values are
 * already 0 across all 4 PO members (i.e., C.4 live run succeeded) before
 * deleting role-type instances. Halts if any member still has role values.
 *
 * IDs consumed from pre-flight artifact:
 *   probe-phase-c-preflight-2026-05-21T15-28-23-732.json
 *   roleTypeInstances: 5 instances
 *   propDefs.role: 5 prop-defs
 *   typeDefIds.role: 69c7ea468489bfcb0e819df9
 *
 * Must follow C.4 in live execution.
 *
 * Run: DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-role-type-entities-2026-05-21.ts
 * Live: DRY_RUN=false pnpm exec tsx ...
 * Auth: live mode requires team-lead "I authorize this run" SendMessage (auth-gate).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  getJwt,
  listInstancesByType,
  fetchEntity,
  deleteEntity,
  type EntuClient,
} from './lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

// IDs from pre-flight probe eb3038f
const ROLE_TYPE_DEF_ID = '69c7ea468489bfcb0e819df9';
const ROLE_PROP_DEFS = [
  { _id: '69c7ea468489bfcb0e819e00', name: 'name' },
  { _id: '69c7ea468489bfcb0e819e0c', name: 'description' },
  { _id: '69c7ea468489bfcb0e819e17', name: 'permissions' },
  { _id: '69c7ea478489bfcb0e819e27', name: 'ordinal' },
  { _id: '69c7ea478489bfcb0e819e31', name: 'member_count' },
];
const ROLE_TYPE_INSTANCES = [
  { _id: '69c7f8708489bfcb0e81b020', displayName: 'Owner' },
  { _id: '69c7f8708489bfcb0e81b02e', displayName: 'Admin' },
  { _id: '69c7f8718489bfcb0e81b03b', displayName: 'Librarian' },
  { _id: '69c7f8718489bfcb0e81b045', displayName: 'Conductor' },
  { _id: '69c7f8718489bfcb0e81b050', displayName: 'Section Leader' },
];
const EXPECTED_INSTANCE_COUNT = 5;

// Member IDs from C.4 preflight — for cross-script gate (live only)
const C4_MEMBER_IDS = [
  '69c7f8728489bfcb0e81b085',
  '69c7f8788489bfcb0e81b1c9',
  '69c7f87e8489bfcb0e81b304',
  '69c7f8878489bfcb0e81b510',
];

if (!API_KEY) { console.error('ERROR: ENTU_API_KEY env var required'); process.exit(1); }

async function main() {
  console.log('Phase C.5 — cleanup-phase-c-role-type-entities');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

  const startedAt = new Date().toISOString();
  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
  const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

  const artifact: {
    phase: string; script: string; dryRun: boolean;
    startedAt: string; completedAt: string;
    initialInstances: number;
    crossScriptGatePassed: boolean | null;
    preservation: Array<{ _id: string; displayName: string; properties: unknown }>;
    instanceResult: Array<{ id: string; displayName: string; outcome: string }>;
    postDeleteVerified: boolean | null;
    propDefsResult: Array<{ id: string; name: string; outcome: string }>;
    typeDefResult: { id: string; outcome: string };
    exitCode: number; errors: string[];
  } = {
    phase: 'C.5', script: 'cleanup-phase-c-role-type-entities',
    dryRun: DRY_RUN, startedAt, completedAt: '',
    initialInstances: 0,
    crossScriptGatePassed: null,
    preservation: [],
    instanceResult: [],
    postDeleteVerified: null,
    propDefsResult: [], typeDefResult: { id: ROLE_TYPE_DEF_ID, outcome: '' },
    exitCode: 0, errors: [],
  };

  try {
    // Pre-flight: verify instance count matches preflight
    console.log('=== Pre-flight: instance count ===');
    const listResp = await listInstancesByType(client, 'role', '_id');
    const liveInstances = ((listResp as { entities?: Array<{ _id: string }> }).entities ?? []);
    artifact.initialInstances = liveInstances.length;
    console.log(`  role-type instances: ${liveInstances.length} (expected ${EXPECTED_INSTANCE_COUNT})`);
    if (liveInstances.length !== EXPECTED_INSTANCE_COUNT) {
      throw new Error(`HALT: expected ${EXPECTED_INSTANCE_COUNT} role-type instances, found ${liveInstances.length}. Drift from pre-flight — investigate.`);
    }
    // Sanity-check: every live ID must be in the hardcoded preflight list (exact-ID drift guard)
    const hardcodedIds = new Set(ROLE_TYPE_INSTANCES.map(r => r._id));
    const unknownIds = liveInstances.filter(i => !hardcodedIds.has(i._id));
    if (unknownIds.length > 0) {
      throw new Error(`HALT: live role instances contain IDs not in preflight hardcoded list: ${unknownIds.map(i => i._id).join(', ')}. ID drift — re-run pre-flight probe before proceeding.`);
    }

    // Cross-script gate: live only — verify C.4 already cleared member.role values
    if (!DRY_RUN) {
      console.log('\n=== Cross-script gate: verify zero member.role values (C.4 completed) ===');
      let totalMemberRoleValues = 0;
      for (const memberId of C4_MEMBER_IDS) {
        const entity = await fetchEntity(client, memberId) as { role?: Array<{ _id?: string }> };
        const count = (entity.role ?? []).filter(v => v._id).length;
        totalMemberRoleValues += count;
        console.log(`  member ${memberId}: ${count} role values (expected 0)`);
      }
      artifact.crossScriptGatePassed = totalMemberRoleValues === 0;
      if (totalMemberRoleValues !== 0) {
        throw new Error(`HALT: cross-script gate FAILED — ${totalMemberRoleValues} member.role values remain. C.4 live run must complete successfully before C.5 can run.`);
      }
      console.log('  Cross-script gate: PASSED (0 member.role values across all 4 members)');
    } else {
      console.log('  [DRY-RUN] cross-script gate skipped (not applicable in dry-run)');
    }

    // Resolve display names from hardcoded list for logging; live list is authoritative for IDs
    const displayNameMap = new Map(ROLE_TYPE_INSTANCES.map(r => [r._id, r.displayName]));

    // Preservation snapshot
    console.log('\n=== Preservation snapshot ===');
    for (const inst of liveInstances) {
      const displayName = displayNameMap.get(inst._id) ?? inst._id;
      const entity = await fetchEntity(client, inst._id);
      artifact.preservation.push({ _id: inst._id, displayName, properties: entity });
      console.log(`  Captured: ${inst._id} "${displayName}"`);
    }

    // Delete role-type instance entities
    console.log('\n=== Delete role-type instance entities ===');
    for (const inst of liveInstances) {
      const displayName = displayNameMap.get(inst._id) ?? inst._id;
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] WOULD DELETE entity (role instance) _id=${inst._id} "${displayName}"`);
        artifact.instanceResult.push({ id: inst._id, displayName, outcome: 'would-delete' });
      } else {
        try {
          await deleteEntity(client, inst._id);
          console.log(`  DELETED role instance "${displayName}" _id=${inst._id}`);
          artifact.instanceResult.push({ id: inst._id, displayName, outcome: 'deleted' });
        } catch (err) {
          const msg = String(err);
          console.error(`  FAILED to delete role instance _id=${inst._id}: ${msg}`);
          artifact.instanceResult.push({ id: inst._id, displayName, outcome: 'failed' });
          artifact.errors.push(`role instance ${inst._id} (${displayName}): ${msg}`);
        }
      }
    }

    // Post-delete verification (live only)
    if (!DRY_RUN) {
      console.log('\n=== Post-delete verification ===');
      const verifyResp = await listInstancesByType(client, 'role', '_id');
      const remaining = ((verifyResp as { entities?: unknown[] }).entities ?? []).length;
      artifact.postDeleteVerified = remaining === 0;
      console.log(`  Remaining role instances: ${remaining} (expected 0)`);
      if (remaining !== 0) {
        throw new Error(`HALT: post-delete verification failed — ${remaining} role instances remain.`);
      }
      console.log('  Post-delete: VERIFIED (0 remaining)');
    }

    // Delete prop-defs on role type
    console.log('\n=== Delete prop-defs ===');
    for (const pd of ROLE_PROP_DEFS) {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] WOULD DELETE entity (prop-def) _id=${pd._id} name="${pd.name}"`);
        artifact.propDefsResult.push({ id: pd._id, name: pd.name, outcome: 'would-delete' });
      } else {
        try {
          await deleteEntity(client, pd._id);
          console.log(`  DELETED prop-def "${pd.name}" _id=${pd._id}`);
          artifact.propDefsResult.push({ id: pd._id, name: pd.name, outcome: 'deleted' });
        } catch (err) {
          const msg = String(err);
          console.error(`  FAILED to delete prop-def "${pd.name}" _id=${pd._id}: ${msg}`);
          artifact.propDefsResult.push({ id: pd._id, name: pd.name, outcome: 'failed' });
          artifact.errors.push(`prop-def ${pd._id} (${pd.name}): ${msg}`);
        }
      }
    }

    // Delete type-def
    console.log('\n=== Delete type-def ===');
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] WOULD DELETE entity (type-def) _id=${ROLE_TYPE_DEF_ID}`);
      artifact.typeDefResult = { id: ROLE_TYPE_DEF_ID, outcome: 'would-delete' };
    } else {
      try {
        await deleteEntity(client, ROLE_TYPE_DEF_ID);
        console.log(`  DELETED type-def _id=${ROLE_TYPE_DEF_ID}`);
        artifact.typeDefResult = { id: ROLE_TYPE_DEF_ID, outcome: 'deleted' };
      } catch (err) {
        const msg = String(err);
        console.error(`  FAILED to delete type-def _id=${ROLE_TYPE_DEF_ID}: ${msg}`);
        artifact.typeDefResult = { id: ROLE_TYPE_DEF_ID, outcome: 'failed' };
        artifact.errors.push(`type-def ${ROLE_TYPE_DEF_ID}: ${msg}`);
      }
    }

  } catch (err) {
    const msg = String(err);
    console.error('\nERROR:', msg);
    artifact.errors.push(msg);
    artifact.exitCode = 1;
  }

  artifact.completedAt = new Date().toISOString();
  if (artifact.errors.length > 0 && artifact.exitCode === 0) artifact.exitCode = 1;

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const dir = join(process.cwd(), 'scripts/migrations/seed-results');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `cleanup-phase-c-role-type-entities-${ts}.json`);
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: ${path}`);

  console.log('\n=== SUMMARY ===');
  console.log(`initialInstances: ${artifact.initialInstances}`);
  console.log(`crossScriptGatePassed: ${artifact.crossScriptGatePassed}`);
  console.log(`preservation: ${artifact.preservation.length} instances`);
  console.log(`instanceResult: ${artifact.instanceResult.map(r => r.outcome).join(', ')}`);
  console.log(`postDeleteVerified: ${artifact.postDeleteVerified}`);
  console.log(`propDefs: ${artifact.propDefsResult.map(r => r.outcome).join(', ')}`);
  console.log(`typeDef: ${artifact.typeDefResult.outcome}`);
  console.log(`errors: ${artifact.errors.length}`);

  if (artifact.exitCode !== 0) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
