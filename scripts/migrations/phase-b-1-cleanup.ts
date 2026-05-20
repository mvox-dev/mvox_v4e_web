/**
 * Phase B.1 cleanup — clear blocked-delete instance data
 *
 * Unblocks the 4 ops that verifyDeleteSafe SAFE-halted in Phase B live execution:
 *   Op #1  org.contact_email — DELETE property values on all 6 org instances
 *   Op #2  org.org_type — DELETE property values on all 6 org instances
 *   Op #3  member.joined_at — DELETE property values on all 116 member instances
 *   Op #4  org.member_count prop-def DELETE — GATED (see comment below)
 *
 * Op #4 is deferred pending team-lead authorization:
 *   Probe 1 fires on 2 word-boundary matches, but BOTH are false positives:
 *   - Match 1 is the prop-def's OWN self-referential formula (deleting the entity also
 *     deletes its own formula property — not a real dependency)
 *   - Match 2 is member_count_per_section whose formula "SUM(_child section.member_count)"
 *     depends on SECTION.member_count, not ORGANIZATION.member_count — a different prop-def
 *   Diagnosis documented in docs/migration/findings/phase-b-1-diagnostic-2026-05-20.md
 *   Team-lead must explicitly authorize before this op runs.
 *
 * Wire shapes:
 *   - Instance property value DELETE: DELETE /property/{value._id}   (NOT /entity/)
 *     The /property/{id} endpoint addresses individual property-value records on instances.
 *     (Bug 1 in Phase B confused this with prop-def entity deletion — see diagnostics doc.)
 *   - Idempotency: query current values before DELETE; skip if already absent.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrations/phase-b-1-cleanup.ts [--dry-run] [--include-op4]
 *
 *   --dry-run        Walk all ops, print what WOULD happen, no writes.
 *   --include-op4    Include Op #4 (org.member_count prop-def DELETE). Requires explicit
 *                    team-lead authorization — do NOT pass this flag without sign-off.
 *
 * Result artifact:
 *   scripts/migrations/seed-results/phase-b-1-cleanup-<ISO-timestamp>.json
 */

import {
	getJwt,
	fetchEntity,
	listInstancesByType,
	deletePropertyValue,
	deleteEntity,
	type EntuClient,
} from './lib/entu-client.js';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';

// prop-def _id for organization.member_count (from Phase B execution report + diagnostic probe)
const ORG_MEMBER_COUNT_PROP_DEF_ID = '69c7ea498489bfcb0e819e96';

type PropValueRef = { entityId: string; propValueId: string };

interface CleanupOpResult {
  op: string;
  description: string;
  found: number;
  deleted: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ── Per-op cleanup logic ──────────────────────────────────────────────────────

async function clearInstancePropValues(
  client: EntuClient,
  opKey: string,
  entityType: string,
  propName: string,
  dryRun: boolean
): Promise<CleanupOpResult> {
  const result: CleanupOpResult = {
    op: opKey,
    description: `Clear ${entityType}.${propName} instance values`,
    found: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  const resp = await listInstancesByType(client, entityType, `_id,${propName}`);
  const entities = resp.entities;
  const toDelete: PropValueRef[] = [];

  for (const entity of entities) {
    const vals = entity[propName] as Array<{ _id?: string }> | undefined;
    if (!Array.isArray(vals) || vals.length === 0) {
      result.skipped += 1;
      continue;
    }
    for (const v of vals) {
      if (v._id) {
        toDelete.push({ entityId: entity._id, propValueId: v._id });
        result.found += 1;
      }
    }
  }

  console.log(`  ${opKey}: found ${result.found} property value(s) to delete across ${entityType} instances`);

  for (const ref of toDelete) {
    try {
      console.log(`    entity ${ref.entityId}: deleting prop value ${ref.propValueId}`);
      if (dryRun) {
        console.log(`    [DRY-RUN] would DELETE /property/${ref.propValueId}`);
      } else {
        await deletePropertyValue(client, ref.propValueId);
      }
      result.deleted += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`entity ${ref.entityId} prop ${ref.propValueId}: ${msg}`);
      result.failed += 1;
      console.error(`    FAILED: ${msg}`);
    }
  }

  return result;
}

async function deleteOrgMemberCountPropDef(
  client: EntuClient,
  dryRun: boolean
): Promise<CleanupOpResult> {
  const result: CleanupOpResult = {
    op: 'op4_org_member_count_propdef',
    description: `Delete organization.member_count prop-def entity (${ORG_MEMBER_COUNT_PROP_DEF_ID})`,
    found: 1,
    deleted: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  // Verify prop-def still exists before attempting deletion.
  try {
    await fetchEntity(client, ORG_MEMBER_COUNT_PROP_DEF_ID);
  } catch {
    result.skipped = 1;
    result.found = 0;
    console.log(`  op4: prop-def ${ORG_MEMBER_COUNT_PROP_DEF_ID} not found (already deleted?) — skipping`);
    return result;
  }

  console.log(`  op4: deleting prop-def entity ${ORG_MEMBER_COUNT_PROP_DEF_ID} (organization.member_count)`);
  try {
    if (dryRun) {
      console.log(`    [DRY-RUN] would DELETE /entity/${ORG_MEMBER_COUNT_PROP_DEF_ID}`);
    } else {
      await deleteEntity(client, ORG_MEMBER_COUNT_PROP_DEF_ID);
    }
    result.deleted = 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    result.failed = 1;
    console.error(`    FAILED: ${msg}`);
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = isDryRun();
  const includeOp4 = process.argv.includes('--include-op4');
  const apiKey = process.env.ENTU_API_KEY;

  if (!apiKey) {
    console.error('ERROR: ENTU_API_KEY env var required');
    process.exit(1);
  }

  const startedAt = new Date();
  console.log(`Phase B.1 cleanup${dryRun ? ' [DRY-RUN]' : ''} starting…`);
  console.log(`  API base: ${API_BASE}`);
  console.log(`  DB: ${DB}`);
  console.log(`  Include Op #4: ${includeOp4}`);
  if (!includeOp4) {
    console.log('  NOTE: Op #4 (org.member_count prop-def) is gated — pass --include-op4 after team-lead auth.');
  }
  console.log();

  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey });
  const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };
  console.log('JWT obtained successfully.\n');

  const results: CleanupOpResult[] = [];

  // Op #1: org.contact_email
  console.log('--- Op #1: organization.contact_email ---');
  results.push(await clearInstancePropValues(client, 'op1_org_contact_email', 'organization', 'contact_email', dryRun));

  // Op #2: org.org_type
  console.log('\n--- Op #2: organization.org_type ---');
  results.push(await clearInstancePropValues(client, 'op2_org_org_type', 'organization', 'org_type', dryRun));

  // Op #3: member.joined_at
  console.log('\n--- Op #3: member.joined_at ---');
  results.push(await clearInstancePropValues(client, 'op3_member_joined_at', 'member', 'joined_at', dryRun));

  // Op #4: org.member_count prop-def DELETE (gated)
  if (includeOp4) {
    console.log('\n--- Op #4: organization.member_count prop-def (--include-op4 authorized) ---');
    results.push(await deleteOrgMemberCountPropDef(client, dryRun));
  } else {
    console.log('\n--- Op #4: organization.member_count prop-def (SKIPPED — not authorized) ---');
    console.log('  Diagnostic: Probe 1 false positive confirmed. See docs/migration/findings/phase-b-1-diagnostic-2026-05-20.md.');
    console.log('  To include: team-lead must authorize, then re-run with --include-op4.');
    results.push({
      op: 'op4_org_member_count_propdef',
      description: `Delete organization.member_count prop-def (${ORG_MEMBER_COUNT_PROP_DEF_ID}) — DEFERRED`,
      found: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      errors: ['deferred: awaiting team-lead authorization (Probe 1 false positive — see diagnostic doc)']
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    const status = r.failed > 0 ? 'PARTIAL/FAILED' : (r.deleted > 0 || dryRun) ? 'OK' : 'NO-OP/DEFERRED';
    console.log(`  ${r.op}: found=${r.found} deleted=${r.deleted} skipped=${r.skipped} failed=${r.failed} [${status}]`);
  }
  console.log(`\nTotal deleted: ${totalDeleted} | Total failed: ${totalFailed}`);

  if (!dryRun) {
    console.log('\nNext step: re-run Phase B to confirm blocked ops now succeed.');
    console.log('  pnpm exec tsx scripts/migrations/2026-05-20-phase-b.ts --skip-snapshot');
  }

  // ── Write result artifact ────────────────────────────────────────────────────
  const artifact = {
    script: 'phase-b-1-cleanup.ts',
    executedAt: startedAt.toISOString(),
    dryRun,
    includeOp4,
    db: DB,
    results
  };
  const outPath = await writeResultArtifact('phase-b-1-cleanup', artifact, { at: startedAt });
  console.log(`\nResult artifact: ${outPath}`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
