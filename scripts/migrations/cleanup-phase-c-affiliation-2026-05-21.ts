/**
 * Phase C.3 — cleanup-phase-c-affiliation
 *
 * Deletes the 4 affiliation instances (collective↔umbrella federation links),
 * then retires all prop-defs and the type-def for `affiliation`.
 *
 * The preservation block in the artifact is the only post-deletion record of
 * the data — deletion via DELETE /entity is irreversible.
 *
 * IDs consumed from pre-flight artifact:
 *   probe-phase-c-preflight-2026-05-21T15-28-23-732.json
 *   affiliationInstances: 4
 *   typeDefIds.affiliation:  69c7ea598489bfcb0e81a178
 *   propDefs.affiliation:    5 prop-defs
 *
 * Run: DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-affiliation-2026-05-21.ts
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
const TYPE_DEF_ID = '69c7ea598489bfcb0e81a178';
const PROP_DEFS = [
  { _id: '69c7ea598489bfcb0e81a17f', name: 'name' },
  { _id: '69c7ea598489bfcb0e81a18b', name: 'umbrella' },
  { _id: '69c7ea5a8489bfcb0e81a197', name: 'joined_at' },
  { _id: '69c7ea5a8489bfcb0e81a1a2', name: 'left_at' },
  { _id: '69c7ff138489bfcb0e81b644', name: 'collective' },
];

// Expected instance count from pre-flight
const EXPECTED_INSTANCE_COUNT = 4;

if (!API_KEY) { console.error('ERROR: ENTU_API_KEY env var required'); process.exit(1); }

async function main() {
  console.log('Phase C.3 — cleanup-phase-c-affiliation');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

  const startedAt = new Date().toISOString();
  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
  const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

  const artifact: {
    phase: string; script: string; dryRun: boolean;
    startedAt: string; completedAt: string;
    initialInstances: number;
    preservation: Array<{ _id: string; properties: unknown }>;
    instanceResult: Array<{ id: string; outcome: string }>;
    postDeleteVerified: boolean | null;
    propDefsResult: Array<{ id: string; name: string; outcome: string }>;
    typeDefResult: { id: string; outcome: string };
    exitCode: number; errors: string[];
  } = {
    phase: 'C.3', script: 'cleanup-phase-c-affiliation',
    dryRun: DRY_RUN, startedAt, completedAt: '',
    initialInstances: 0,
    preservation: [],
    instanceResult: [],
    postDeleteVerified: null,
    propDefsResult: [], typeDefResult: { id: TYPE_DEF_ID, outcome: '' },
    exitCode: 0, errors: [],
  };

  try {
    // Pre-flight: verify instance count matches preflight
    console.log('=== Pre-flight: instance count ===');
    const listResp = await listInstancesByType(client, 'affiliation', '_id');
    const instanceIds = ((listResp as { entities?: Array<{ _id: string }> }).entities ?? []).map(e => e._id);
    artifact.initialInstances = instanceIds.length;
    console.log(`  affiliation instances: ${instanceIds.length} (expected ${EXPECTED_INSTANCE_COUNT})`);
    if (instanceIds.length !== EXPECTED_INSTANCE_COUNT) {
      throw new Error(`HALT: expected ${EXPECTED_INSTANCE_COUNT} affiliation instances, found ${instanceIds.length}. Drift from pre-flight — investigate.`);
    }

    // Preservation snapshot: fetch each instance in full
    console.log('\n=== Preservation snapshot ===');
    for (const id of instanceIds) {
      const entity = await fetchEntity(client, id);
      artifact.preservation.push({ _id: id, properties: entity });
      const nameStr = ((entity as { name?: Array<{ string?: string }> }).name?.[0]?.string) ?? '(unnamed)';
      console.log(`  Captured: ${id} "${nameStr}"`);
    }

    // Delete instances
    console.log('\n=== Delete instances ===');
    for (const id of instanceIds) {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] WOULD DELETE entity (affiliation instance) _id=${id}`);
        artifact.instanceResult.push({ id, outcome: 'would-delete' });
      } else {
        try {
          await deleteEntity(client, id);
          console.log(`  DELETED affiliation instance _id=${id}`);
          artifact.instanceResult.push({ id, outcome: 'deleted' });
        } catch (err) {
          const msg = String(err);
          console.error(`  FAILED to delete instance _id=${id}: ${msg}`);
          artifact.instanceResult.push({ id, outcome: 'failed' });
          artifact.errors.push(`instance ${id}: ${msg}`);
        }
      }
    }

    // Post-delete verification (live only)
    if (!DRY_RUN) {
      console.log('\n=== Post-delete verification ===');
      const verifyResp = await listInstancesByType(client, 'affiliation', '_id');
      const remaining = ((verifyResp as { entities?: unknown[] }).entities ?? []).length;
      artifact.postDeleteVerified = remaining === 0;
      console.log(`  Remaining affiliation instances: ${remaining} (expected 0)`);
      if (remaining !== 0) {
        throw new Error(`HALT: post-delete verification failed — ${remaining} affiliation instances remain.`);
      }
      console.log('  Post-delete: VERIFIED (0 remaining)');
    }

    // Delete prop-defs
    console.log('\n=== Delete prop-defs ===');
    for (const pd of PROP_DEFS) {
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
      console.log(`  [DRY-RUN] WOULD DELETE entity (type-def) _id=${TYPE_DEF_ID}`);
      artifact.typeDefResult = { id: TYPE_DEF_ID, outcome: 'would-delete' };
    } else {
      try {
        await deleteEntity(client, TYPE_DEF_ID);
        console.log(`  DELETED type-def _id=${TYPE_DEF_ID}`);
        artifact.typeDefResult = { id: TYPE_DEF_ID, outcome: 'deleted' };
      } catch (err) {
        const msg = String(err);
        console.error(`  FAILED to delete type-def _id=${TYPE_DEF_ID}: ${msg}`);
        artifact.typeDefResult = { id: TYPE_DEF_ID, outcome: 'failed' };
        artifact.errors.push(`type-def ${TYPE_DEF_ID}: ${msg}`);
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
  const path = join(dir, `cleanup-phase-c-affiliation-${ts}.json`);
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: ${path}`);

  console.log('\n=== SUMMARY ===');
  console.log(`initialInstances: ${artifact.initialInstances}`);
  console.log(`preservation: ${artifact.preservation.length}`);
  console.log(`instanceResult: ${artifact.instanceResult.map(r => r.outcome).join(', ')}`);
  console.log(`postDeleteVerified: ${artifact.postDeleteVerified}`);
  console.log(`propDefs: ${artifact.propDefsResult.map(r => r.outcome).join(', ')}`);
  console.log(`typeDef: ${artifact.typeDefResult.outcome}`);
  console.log(`errors: ${artifact.errors.length}`);

  if (artifact.exitCode !== 0) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
