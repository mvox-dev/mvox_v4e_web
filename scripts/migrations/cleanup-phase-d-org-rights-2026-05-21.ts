/**
 * Phase D — Sub-op 5: Set _inheritrights=false on all 6 organization instances
 *
 * Per memory `project_polyphony_org_rights_isolation` and architecture-decisions.md:
 * `_inheritrights: false` on organization entities is load-bearing — it blocks rights
 * cascade from umbrella to collective. v4E schema requires this; live polyphony currently
 * has _inheritrights=true on all 6 orgs (confirmed by probe-phase-d-discovery-2026-05-21).
 *
 * Wire shape: per Entu probe-mutation findings (architecture-decisions.md):
 * - Read current _inheritrights value _id
 * - DELETE the existing _inheritrights property value
 * - POST {type:'_inheritrights', boolean:false}
 * (Entu POST appends; must DELETE old value first for replace semantics)
 *
 * Risk tier: MEDIUM — rights changes have blast radius. Bentham pre-execution review
 * required before live run. Dry-run first.
 *
 * Run: npx tsx scripts/migrations/cleanup-phase-d-org-rights-2026-05-21.ts [--dry-run]
 */

import {
  getJwt,
  listInstancesByType,
  fetchEntity,
  deletePropertyValue,
  postProperties,
  type EntuClient,
} from './lib/entu-client.js';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
  console.error('ERROR: ENTU_API_KEY env var required');
  process.exit(1);
}

interface OrgEntity {
  _id: string;
  name?: Array<{ _id?: string; string?: string }>;
  _inheritrights?: Array<{ _id?: string; boolean?: boolean }>;
}

async function main() {
  const dryRun = isDryRun();
  console.log('Phase D — Sub-op 5: Set _inheritrights=false on all organization instances');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
  const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

  // Read all org instances with _inheritrights
  const orgsResp = await listInstancesByType(
    client, 'organization', '_id,name,_inheritrights'
  );
  const orgs = orgsResp.entities as OrgEntity[];
  console.log(`Found ${orgs.length} organization instances\n`);

  const results: Array<{
    _id: string;
    name: string;
    currentInheritRights: boolean | null;
    existingValueId: string | null;
    newValueId: string | null;
    action: 'SET_FALSE' | 'ALREADY_FALSE' | 'DRY-RUN' | 'FAILED';
    error?: string;
  }> = [];

  let set = 0;
  let alreadyFalse = 0;
  let failed = 0;

  for (const org of orgs) {
    const orgName = org.name?.[0]?.string ?? '(unnamed)';
    const inheritRightsArr = org._inheritrights ?? [];
    const currentVal: boolean | null = inheritRightsArr[0]?.boolean ?? null;
    const existingValueId = inheritRightsArr[0]?._id ?? null;

    console.log(`  Org: "${orgName}" (_id=${org._id})`);
    console.log(`    _inheritrights: ${currentVal === null ? '(not set)' : currentVal}  value _id: ${existingValueId ?? '(none)'}`);

    if (currentVal === false) {
      console.log(`    SKIP — already false`);
      results.push({ _id: org._id, name: orgName, currentInheritRights: currentVal, existingValueId, newValueId: existingValueId, action: 'ALREADY_FALSE' });
      alreadyFalse++;
      continue;
    }

    if (dryRun) {
      if (existingValueId) {
        console.log(`    [DRY-RUN] WOULD DELETE _inheritrights value _id=${existingValueId}`);
      }
      console.log(`    [DRY-RUN] WOULD POST _inheritrights=false`);
      results.push({ _id: org._id, name: orgName, currentInheritRights: currentVal, existingValueId, newValueId: null, action: 'DRY-RUN' });
      continue;
    }

    try {
      // DELETE existing value if present
      if (existingValueId) {
        await deletePropertyValue(client, existingValueId);
        console.log(`    DELETED existing _inheritrights value _id=${existingValueId}`);
      }

      // POST false
      await postProperties(client, org._id, [{ type: '_inheritrights', boolean: false }]);
      console.log(`    SET _inheritrights=false`);

      // Verify and capture new value _id
      const orgAfter = await fetchEntity(client, org._id) as OrgEntity;
      const newIrEntry = (orgAfter._inheritrights ?? [])[0];
      const verifiedVal = newIrEntry?.boolean;
      if (verifiedVal !== false) {
        throw new Error(`Verification failed: _inheritrights is now ${verifiedVal} (expected false)`);
      }
      const newValueId = newIrEntry?._id ?? null;
      console.log(`    VERIFIED: _inheritrights=false  new value _id=${newValueId}`);

      results.push({ _id: org._id, name: orgName, currentInheritRights: currentVal, existingValueId, newValueId, action: 'SET_FALSE' });
      set++;
    } catch (err) {
      console.error(`    ERROR: ${err}`);
      results.push({ _id: org._id, name: orgName, currentInheritRights: currentVal, existingValueId, newValueId: null, action: 'FAILED', error: String(err) });
      failed++;
    }
  }

  // Write artifact
  const payload = {
    dryRun,
    runAt: new Date().toISOString(),
    orgCount: orgs.length,
    set,
    alreadyFalse,
    failed,
    dryRunWouldSet: dryRun ? results.filter(r => r.action === 'DRY-RUN').length : 0,
    results,
  };
  const filePath = await writeResultArtifact('cleanup-phase-d-org-rights', payload);
  console.log(`\nArtifact: ${filePath}`);

  // Summary
  console.log('\n=== SUMMARY ===');
  if (dryRun) {
    const wouldSet = results.filter(r => r.action === 'DRY-RUN');
    console.log(`DRY-RUN: WOULD set _inheritrights=false on ${wouldSet.length} orgs, ${alreadyFalse} already correct`);
    for (const r of wouldSet) {
      console.log(`  ${r.name} (${r._id}): current=${r.currentInheritRights ?? '(not set)'}`);
    }
    console.log('No writes performed. Re-run without --dry-run after Bentham GREEN + team-lead authorization.');
  } else if (failed > 0) {
    console.log(`PARTIAL: set=${set} already=${alreadyFalse} failed=${failed}`);
    process.exit(1);
  } else {
    console.log(`Set: ${set}  Already correct: ${alreadyFalse}  Failed: ${failed}`);
    console.log('All organization instances now have _inheritrights=false.');
    console.log('Rights isolation boundaries active per v4E schema.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
