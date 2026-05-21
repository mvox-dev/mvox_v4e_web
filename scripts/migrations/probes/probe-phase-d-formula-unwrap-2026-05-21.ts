/**
 * Phase D formula-unwrap probe — destructive on throwaway entities only
 *
 * Question: When you DELETE the `formula` property value from a prop-def entity,
 * does the property on new instances become plain-writable? And on existing instances,
 * does the stale formula-materialized value persist or get cleared?
 *
 * Probe plan:
 * 1. Create a throwaway type `_probe_phase_d_formula_unwrap` with two prop-defs:
 *    - `probe_name` (formula: `probe_forename ' ' probe_surname`)
 *    - `probe_forename` (plain string)
 *    - `probe_surname` (plain string)
 * 2. Create a throwaway instance; set probe_forename + probe_surname → verify probe_name formula materializes
 * 3. DELETE the `formula` value from `probe_name` prop-def
 * 4. POST probe_name directly to an instance → verify it sticks (not silently dropped)
 * 5. Verify existing instance's stale formula value is unchanged OR cleared
 * 6. Clean up: delete all probe entities
 *
 * Authorization: writes to throwaway `_probe_*` entities only. Per team convention.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  getJwt,
  createEntity,
  fetchEntity,
  postProperties,
  deletePropertyValue,
  deleteEntity,
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

async function rawGet(jwt: string, path: string): Promise<unknown> {
  const url = `${API_BASE}/${DB}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
  return res.json();
}

interface EntityFields {
  _id: string;
  probe_name?: Array<{ _id?: string; string?: string }>;
  probe_forename?: Array<{ _id?: string; string?: string }>;
  probe_surname?: Array<{ _id?: string; string?: string }>;
  name?: Array<{ _id?: string; string?: string }>;
  formula?: Array<{ _id?: string; string?: string }>;
  type?: Array<{ _id?: string; string?: string }>;
  [key: string]: unknown;
}

const log: string[] = [];
function step(msg: string) {
  console.log(msg);
  log.push(msg);
}

async function main() {
  step('Phase D formula-unwrap probe');
  step(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

  const createdEntityIds: string[] = [];

  try {
    // ── Step 1: Create throwaway type entity ──────────────────────────────────
    step('=== Step 1: Create probe type entity ===');
    const probeType = await createEntity({ apiBase: API_BASE, db: DB, jwt }, [
      { type: '_type', reference: POLYPHONY_META_TYPE_ENTITY_ID },
      { type: '_sharing', string: 'public' },
      { type: 'name', string: '_probe_phase_d_formula_unwrap' },
    ]);
    createdEntityIds.push(probeType._id);
    step(`  Probe type created: _id=${probeType._id}`);

    // ── Step 2: Create prop-defs on the probe type ────────────────────────────
    step('\n=== Step 2: Create prop-defs ===');

    // probe_forename — plain string
    const forenameDefResp = await createEntity({ apiBase: API_BASE, db: DB, jwt }, [
      { type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
      { type: '_parent', reference: probeType._id },
      { type: '_sharing', string: 'public' },
      { type: 'name', string: 'probe_forename' },
      { type: 'type', string: 'string' },
    ]);
    createdEntityIds.push(forenameDefResp._id);
    step(`  probe_forename prop-def: _id=${forenameDefResp._id}`);

    // probe_surname — plain string
    const surnameDefResp = await createEntity({ apiBase: API_BASE, db: DB, jwt }, [
      { type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
      { type: '_parent', reference: probeType._id },
      { type: '_sharing', string: 'public' },
      { type: 'name', string: 'probe_surname' },
      { type: 'type', string: 'string' },
    ]);
    createdEntityIds.push(surnameDefResp._id);
    step(`  probe_surname prop-def: _id=${surnameDefResp._id}`);

    // probe_name — formula property
    const nameDefResp = await createEntity({ apiBase: API_BASE, db: DB, jwt }, [
      { type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
      { type: '_parent', reference: probeType._id },
      { type: '_sharing', string: 'public' },
      { type: 'name', string: 'probe_name' },
      { type: 'type', string: 'string' },
      { type: 'formula', string: "probe_forename ' ' probe_surname" },
    ]);
    createdEntityIds.push(nameDefResp._id);
    step(`  probe_name prop-def (formula): _id=${nameDefResp._id}`);

    // ── Step 3: Create probe instance, set forename + surname ─────────────────
    step('\n=== Step 3: Create probe instance ===');
    const instance1 = await createEntity({ apiBase: API_BASE, db: DB, jwt }, [
      { type: '_type', reference: probeType._id },
      { type: '_sharing', string: 'public' },
      { type: 'probe_forename', string: 'Test' },
      { type: 'probe_surname', string: 'Probe' },
    ]);
    createdEntityIds.push(instance1._id);
    step(`  Instance created: _id=${instance1._id}`);

    // Wait a moment for formula to materialize, then read
    await new Promise(r => setTimeout(r, 2000));
    const inst1Before = await rawGet(jwt, `entity/${instance1._id}`) as { entity: EntityFields };
    const nameBefore = inst1Before.entity.probe_name?.[0]?.string ?? '(absent)';
    step(`  probe_name BEFORE formula removal: "${nameBefore}"`);
    step(`  Expected: "Test Probe" (formula materialized) or "(absent)" if formula hasn't fired yet`);

    // ── Step 4: Read the probe_name prop-def to get formula value _id ─────────
    step('\n=== Step 4: Read probe_name prop-def to find formula value _id ===');
    const namePropDef = await rawGet(jwt, `entity/${nameDefResp._id}`) as { entity: EntityFields };
    const formulaValues = namePropDef.entity.formula ?? [];
    step(`  formula values on prop-def: ${JSON.stringify(formulaValues)}`);

    if (formulaValues.length === 0) {
      step('  WARNING: No formula value found on prop-def — may not have persisted');
    }

    // ── Step 5: DELETE the formula value from the prop-def ────────────────────
    step('\n=== Step 5: DELETE formula value from prop-def ===');
    let formulaDeleted = false;
    for (const fv of formulaValues) {
      if (fv._id) {
        await deletePropertyValue({ apiBase: API_BASE, db: DB, jwt }, fv._id);
        step(`  Deleted formula value _id=${fv._id}`);
        formulaDeleted = true;
      }
    }
    if (!formulaDeleted) {
      step('  No formula value _id to delete — skipping');
    }

    // Re-read prop-def to verify formula gone
    await new Promise(r => setTimeout(r, 1000));
    const namePropDefAfter = await rawGet(jwt, `entity/${nameDefResp._id}`) as { entity: EntityFields };
    const formulaAfter = namePropDefAfter.entity.formula ?? [];
    step(`  formula values AFTER DELETE: ${JSON.stringify(formulaAfter)} (expect: [])`);

    // ── Step 6: Verify existing instance — does stale value persist? ──────────
    step('\n=== Step 6: Check instance1 probe_name AFTER formula removal ===');
    const inst1After = await rawGet(jwt, `entity/${instance1._id}`) as { entity: EntityFields };
    const nameAfterDef = inst1After.entity.probe_name?.[0]?.string ?? '(absent)';
    step(`  probe_name AFTER formula removal on prop-def: "${nameAfterDef}"`);
    step(`  Hypothesis: stale value persists (per Q4 findings re: instance-level source deletion)`);

    // ── Step 7: Try to POST probe_name directly on instance1 ─────────────────
    step('\n=== Step 7: POST probe_name directly to instance1 ===');
    await postProperties({ apiBase: API_BASE, db: DB, jwt }, instance1._id, [
      { type: 'probe_name', string: 'Direct Write Test' },
    ]);
    await new Promise(r => setTimeout(r, 1000));
    const inst1AfterWrite = await rawGet(jwt, `entity/${instance1._id}`) as { entity: EntityFields };
    const nameAfterWrite = inst1AfterWrite.entity.probe_name?.map(v => v.string) ?? [];
    step(`  probe_name AFTER direct POST: ${JSON.stringify(nameAfterWrite)}`);
    step(`  Expected: ["Direct Write Test"] if plain; ["Test Probe"] or multi-value if formula still active`);

    // ── Step 8: Create a NEW instance after formula removal ───────────────────
    step('\n=== Step 8: Create new instance AFTER formula removal ===');
    const instance2 = await createEntity({ apiBase: API_BASE, db: DB, jwt }, [
      { type: '_type', reference: probeType._id },
      { type: '_sharing', string: 'public' },
      { type: 'probe_name', string: 'Fresh Plain Name' },
    ]);
    createdEntityIds.push(instance2._id);
    step(`  New instance: _id=${instance2._id}`);
    await new Promise(r => setTimeout(r, 1000));
    const inst2Read = await rawGet(jwt, `entity/${instance2._id}`) as { entity: EntityFields };
    const newInstName = inst2Read.entity.probe_name?.map(v => v.string) ?? [];
    step(`  probe_name on new instance: ${JSON.stringify(newInstName)}`);
    step(`  Expected: ["Fresh Plain Name"] if plain write works`);

    // ── Conclusions ───────────────────────────────────────────────────────────
    step('\n=== CONCLUSIONS ===');
    const formulaGone = formulaAfter.length === 0;
    const existingStale = nameAfterDef;
    const directWriteStuck = nameAfterWrite.includes('Direct Write Test');
    const freshWriteStuck = newInstName.includes('Fresh Plain Name');

    step(`  formula deleted from prop-def: ${formulaGone}`);
    step(`  existing instance stale value: "${existingStale}"`);
    step(`  direct POST to existing instance stuck: ${directWriteStuck} (values: ${JSON.stringify(nameAfterWrite)})`);
    step(`  fresh instance plain write stuck: ${freshWriteStuck} (values: ${JSON.stringify(newInstName)})`);

    if (formulaGone && freshWriteStuck) {
      step('\n  RESULT: Formula-unwrap WORKS — DELETE formula value from prop-def converts to plain writable');
      step('  Sub-op 1 plan is VALID: DELETE formula value on person.name prop-def, then POST plain names');
    } else if (!formulaGone) {
      step('\n  RESULT: Formula value not deleted — investigate further');
    } else {
      step('\n  RESULT: Inconclusive — fresh write did not stick, formula may still be active via another mechanism');
    }

    // Write artifact
    const summary = {
      probeDate: new Date().toISOString(),
      probeTypeName: '_probe_phase_d_formula_unwrap',
      probeTypeId: probeType._id,
      nameDefId: nameDefResp._id,
      instance1Id: instance1._id,
      instance2Id: instance2._id,
      formulaGoneAfterDelete: formulaGone,
      existingInstanceNameBeforeFormulaRemoval: nameBefore,
      existingInstanceNameAfterFormulaRemoval: nameAfterDef,
      existingInstanceNameAfterDirectPost: nameAfterWrite,
      freshInstanceNameAfterPlainWrite: newInstName,
      conclusion: formulaGone && freshWriteStuck
        ? 'FORMULA_UNWRAP_WORKS'
        : !formulaGone
        ? 'FORMULA_DELETE_FAILED'
        : 'INCONCLUSIVE',
      log,
    };

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join('scripts', 'migrations', 'seed-results');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `probe-phase-d-formula-unwrap-${ts}.json`);
    writeFileSync(filePath, JSON.stringify(summary, null, 2));
    step(`\nArtifact written: ${filePath}`);

  } finally {
    // ── Cleanup: delete all probe entities ────────────────────────────────────
    step('\n=== Cleanup: deleting probe entities ===');
    for (const id of [...createdEntityIds].reverse()) {
      try {
        await deleteEntity({ apiBase: API_BASE, db: DB, jwt }, id);
        step(`  Deleted entity ${id}`);
      } catch (err) {
        step(`  WARNING: could not delete ${id}: ${err}`);
      }
    }
    step('  Cleanup complete');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
