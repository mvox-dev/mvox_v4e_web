/**
 * Phase D — Sub-op 1: Convert person.name from formula → plain string
 *
 * The person type's `name` prop-def currently has a formula: `forename ' ' surname`.
 * v4E schema.ts declares person.name as a plain string. This script aligns live
 * polyphony with the already-landed schema — no Schema-Change trailer needed.
 *
 * Wire shape (verified: probe-phase-d-formula-unwrap-2026-05-21):
 * 1. DELETE /property/{formulaValueId} on the name prop-def
 * 2. Verify formula=[] on the prop-def after delete
 * 3. Verify a direct name POST on a test person sticks (sanity check)
 *
 * Known IDs (from probe-phase-d-discovery-2026-05-21):
 * - person.name prop-def entity _id: 69bcfd8e9c031ab8e6ce8068
 * - formula property value _id:      69bcfd8e9c031ab8e6ce81cb
 *
 * Run: npx tsx scripts/migrations/cleanup-phase-d-name-to-plain-2026-05-21.ts [--dry-run]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  getJwt,
  fetchEntity,
  deletePropertyValue,
  type EntuClient,
} from './lib/entu-client.js';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

// Verified from probe-phase-d-discovery-2026-05-21
const PERSON_NAME_PROP_DEF_ID = '69bcfd8e9c031ab8e6ce8068';
const PERSON_NAME_FORMULA_VALUE_ID = '69bcfd8e9c031ab8e6ce81cb';

// Sanity-check test person: PO (has non-whitespace name, will verify write sticks)
// We POST name then immediately DELETE it to restore original state.
const SANITY_CHECK_PERSON_ID = '69bcfd8e9c031ab8e6ce8079'; // PO

if (!API_KEY) {
  console.error('ERROR: ENTU_API_KEY env var required');
  process.exit(1);
}

interface EntityFields {
  _id: string;
  formula?: Array<{ _id?: string; string?: string }>;
  name?: Array<{ _id?: string; string?: string }>;
  [key: string]: unknown;
}

async function main() {
  const dryRun = isDryRun();
  console.log(`Phase D — Sub-op 1: person.name formula → plain`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
  const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

  const result: {
    dryRun: boolean;
    runAt: string;
    propDefId: string;
    formulaValueId: string;
    beforeFormula: string | null;
    afterFormula: string | null;
    formulaDeleted: boolean;
    sanityCheckPassed: boolean | null;
    error: string | null;
  } = {
    dryRun,
    runAt: new Date().toISOString(),
    propDefId: PERSON_NAME_PROP_DEF_ID,
    formulaValueId: PERSON_NAME_FORMULA_VALUE_ID,
    beforeFormula: null,
    afterFormula: null,
    formulaDeleted: false,
    sanityCheckPassed: null,
    error: null,
  };

  try {
    // ── Step 1: Read current state of person.name prop-def ───────────────────
    console.log('=== Step 1: Read person.name prop-def ===');
    const propDef = await fetchEntity(client, PERSON_NAME_PROP_DEF_ID) as EntityFields;
    const formulaValues = propDef.formula ?? [];
    const currentFormula = formulaValues[0]?.string ?? null;
    result.beforeFormula = currentFormula;

    console.log(`  prop-def _id: ${PERSON_NAME_PROP_DEF_ID}`);
    console.log(`  current formula: ${currentFormula !== null ? `"${currentFormula}"` : '(none — already plain)'}`);

    if (formulaValues.length === 0) {
      console.log('  SKIP: prop-def has no formula value — already plain string. Nothing to do.');
      result.afterFormula = null;
      result.formulaDeleted = false;
      result.sanityCheckPassed = true;
      return;
    }

    // Confirm the formula value _id matches what we expect
    const liveFormulaValueId = formulaValues[0]?._id;
    if (liveFormulaValueId && liveFormulaValueId !== PERSON_NAME_FORMULA_VALUE_ID) {
      console.log(`  WARNING: live formula value _id (${liveFormulaValueId}) differs from expected (${PERSON_NAME_FORMULA_VALUE_ID})`);
      console.log(`  Using live formula value _id: ${liveFormulaValueId}`);
    }
    const formulaValueId = liveFormulaValueId ?? PERSON_NAME_FORMULA_VALUE_ID;

    // ── Step 2: Delete the formula value from the prop-def ───────────────────
    console.log('\n=== Step 2: Delete formula value from prop-def ===');
    if (dryRun) {
      console.log(`  [DRY-RUN] WOULD DELETE /property/${formulaValueId}`);
      result.formulaDeleted = false;
      result.afterFormula = currentFormula;
    } else {
      await deletePropertyValue(client, formulaValueId);
      console.log(`  Deleted formula value _id=${formulaValueId}`);
      result.formulaDeleted = true;

      // Verify
      const propDefAfter = await fetchEntity(client, PERSON_NAME_PROP_DEF_ID) as EntityFields;
      const formulaAfter = propDefAfter.formula ?? [];
      result.afterFormula = formulaAfter[0]?.string ?? null;
      console.log(`  formula after delete: ${formulaAfter.length === 0 ? '[] (confirmed empty)' : JSON.stringify(formulaAfter)}`);

      if (formulaAfter.length > 0) {
        throw new Error(`Formula still present after DELETE: ${JSON.stringify(formulaAfter)}`);
      }
    }

    // ── Step 3: Sanity check — verify plain write works on a person ──────────
    console.log('\n=== Step 3: Sanity check — plain write on PO person ===');
    if (dryRun) {
      console.log('  [DRY-RUN] WOULD: POST name="__sanity_check__" to PO, verify it sticks, DELETE it');
      result.sanityCheckPassed = null;
    } else {
      // Read current PO name (to restore)
      const poBefore = await fetchEntity(client, SANITY_CHECK_PERSON_ID) as EntityFields;
      const poNameValues = poBefore.name ?? [];
      console.log(`  PO current name values: ${JSON.stringify(poNameValues.map(v => ({ _id: v._id, string: v.string })))}`);

      // POST test name
      const testName = '__phase_d_sanity_check__';
      const testPostUrl = `${API_BASE}/${DB}/entity/${SANITY_CHECK_PERSON_ID}`;
      const testRes = await fetch(testPostUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ type: 'name', string: testName }]),
      });
      if (!testRes.ok) throw new Error(`Sanity POST failed: ${testRes.status} ${await testRes.text()}`);

      // Read back
      const poAfterWrite = await fetchEntity(client, SANITY_CHECK_PERSON_ID) as EntityFields;
      const nameAfterWrite = poAfterWrite.name ?? [];
      const testStuck = nameAfterWrite.some(v => v.string === testName);
      console.log(`  After POST: name values = ${JSON.stringify(nameAfterWrite.map(v => v.string))}`);
      console.log(`  Test value stuck: ${testStuck}`);

      if (!testStuck) {
        throw new Error('Sanity check FAILED: plain POST to person.name did not stick — formula may still be active');
      }

      // Clean up: delete the test name value (and any other non-original name values)
      const testNameValueIds = nameAfterWrite
        .filter(v => v.string !== 'Mihkel Putrinš')
        .map(v => v._id)
        .filter(Boolean) as string[];
      for (const id of testNameValueIds) {
        await deletePropertyValue(client, id);
        console.log(`  Cleaned up test name value _id=${id}`);
      }

      // Verify PO name is back to original
      const poFinal = await fetchEntity(client, SANITY_CHECK_PERSON_ID) as EntityFields;
      const finalNames = (poFinal.name ?? []).map(v => v.string);
      console.log(`  PO final name values: ${JSON.stringify(finalNames)}`);

      result.sanityCheckPassed = testStuck;
      console.log(`  Sanity check: ${testStuck ? 'PASSED' : 'FAILED'}`);
    }

  } catch (err) {
    result.error = String(err);
    console.error('\nERROR:', err);
  }

  // ── Write result artifact ─────────────────────────────────────────────────
  const filePath = await writeResultArtifact('cleanup-phase-d-name-to-plain', result);
  console.log(`\nArtifact: ${filePath}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  if (dryRun) {
    console.log(`DRY-RUN: WOULD DELETE formula value ${PERSON_NAME_FORMULA_VALUE_ID} from person.name prop-def`);
    console.log('No writes performed. Re-run without --dry-run to execute.');
  } else if (result.error) {
    console.log(`FAILED: ${result.error}`);
    process.exit(1);
  } else {
    console.log(`formula deleted: ${result.formulaDeleted}`);
    console.log(`before: "${result.beforeFormula}" → after: ${result.afterFormula === null ? 'plain (no formula)' : `"${result.afterFormula}"`}`);
    console.log(`sanity check passed: ${result.sanityCheckPassed}`);
    console.log('\nperson.name is now a plain writable string on polyphony.');
    console.log('Next: run cleanup-phase-d-seed-names-2026-05-21.ts to backfill 120 seed persons.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
