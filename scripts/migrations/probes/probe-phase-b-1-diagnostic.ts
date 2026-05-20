/**
 * Phase B.1 diagnostic probe — read-only
 * Checks live state of the 4 blocked deletes from Phase B execution.
 *
 * Op #1: organization.contact_email — instances still holding values?
 * Op #2: organization.org_type — instances still holding values?
 * Op #3: member.joined_at — instances still holding values?
 * Op #4: organization.member_count (prop-def _id 69c7ea498489bfcb0e819e96) — Probe 1 false positive?
 *
 * Authorization: read-only probes against live polyphony. No writes.
 */

import { getJwt, POLYPHONY_META_TYPE_PROPERTY_ID } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

// prop-def _id for organization.member_count (from Phase B execution report)
const MEMBER_COUNT_PROP_DEF_ID = '69c7ea498489bfcb0e819e96';

if (!API_KEY) {
  console.error('ERROR: ENTU_API_KEY env var required');
  process.exit(1);
}

async function get(jwt: string, path: string): Promise<unknown> {
  const url = `${API_BASE}/${DB}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Phase B.1 diagnostic probe — read-only');
  console.log(`DB: ${DB}\n`);

  const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

  // ── Op #1: organization.contact_email ───────────────────────────────────────
  console.log('=== Op #1: organization.contact_email ===');
  const orgContactEmailResp = await get(
    jwt,
    'entity?_type.string=organization&props=_id,contact_email&limit=500'
  ) as { entities?: Array<{ _id: string; contact_email?: Array<{ _id?: string; string?: string }> }>; count?: number };

  const orgsWithContactEmail = (orgContactEmailResp.entities ?? []).filter(
    (e) => Array.isArray(e.contact_email) && e.contact_email.length > 0
  );
  console.log(`  Total orgs: ${orgContactEmailResp.count ?? 0}`);
  console.log(`  With contact_email: ${orgsWithContactEmail.length}`);
  for (const e of orgsWithContactEmail) {
    const propIds = (e.contact_email ?? []).map((v) => v._id).filter(Boolean);
    console.log(`    entity ${e._id}: prop value _id(s): ${JSON.stringify(propIds)}`);
  }

  // ── Op #2: organization.org_type ────────────────────────────────────────────
  console.log('\n=== Op #2: organization.org_type ===');
  const orgTypeResp = await get(
    jwt,
    'entity?_type.string=organization&props=_id,org_type&limit=500'
  ) as { entities?: Array<{ _id: string; org_type?: Array<{ _id?: string; string?: string }> }>; count?: number };

  const orgsWithOrgType = (orgTypeResp.entities ?? []).filter(
    (e) => Array.isArray(e.org_type) && e.org_type.length > 0
  );
  console.log(`  Total orgs: ${orgTypeResp.count ?? 0}`);
  console.log(`  With org_type: ${orgsWithOrgType.length}`);
  for (const e of orgsWithOrgType) {
    const propIds = (e.org_type ?? []).map((v) => v._id).filter(Boolean);
    const vals = (e.org_type ?? []).map((v) => v.string).filter(Boolean);
    console.log(`    entity ${e._id}: values ${JSON.stringify(vals)}, prop _id(s): ${JSON.stringify(propIds)}`);
  }

  // ── Op #3: member.joined_at ──────────────────────────────────────────────────
  console.log('\n=== Op #3: member.joined_at ===');
  const memberJoinedAtResp = await get(
    jwt,
    'entity?_type.string=member&props=_id,joined_at&limit=500'
  ) as { entities?: Array<{ _id: string; joined_at?: Array<{ _id?: string; string?: string; number?: number }> }>; count?: number };

  const membersWithJoinedAt = (memberJoinedAtResp.entities ?? []).filter(
    (e) => Array.isArray(e.joined_at) && e.joined_at.length > 0
  );
  console.log(`  Total members: ${memberJoinedAtResp.count ?? 0}`);
  console.log(`  With joined_at: ${membersWithJoinedAt.length}`);
  // Don't print all 116, just the count + first 3
  for (const e of membersWithJoinedAt.slice(0, 3)) {
    const propIds = (e.joined_at ?? []).map((v) => v._id).filter(Boolean);
    console.log(`    entity ${e._id}: prop _id(s): ${JSON.stringify(propIds)}`);
  }
  if (membersWithJoinedAt.length > 3) {
    console.log(`    ... and ${membersWithJoinedAt.length - 3} more`);
  }
  // Collect all prop value _ids for the cleanup script
  const allJoinedAtPropIds: string[] = [];
  for (const e of membersWithJoinedAt) {
    for (const v of e.joined_at ?? []) {
      if (v._id) allJoinedAtPropIds.push(v._id);
    }
  }
  console.log(`  Total joined_at property value _ids to delete: ${allJoinedAtPropIds.length}`);

  // ── Op #4: organization.member_count — Probe 1 word-boundary check ──────────
  console.log('\n=== Op #4: organization.member_count — Probe 1 re-run ===');
  console.log(`  prop-def _id: ${MEMBER_COUNT_PROP_DEF_ID}`);

  // Re-run verifyDeleteSafe Probe 1 logic: q=member_count, filter by word-boundary
  const formulaProbeResp = await get(
    jwt,
    `entity?_type.reference=${POLYPHONY_META_TYPE_PROPERTY_ID}&q=${encodeURIComponent('member_count')}&props=_id,formula,name&limit=50`
  ) as { entities?: Array<{ _id: string; formula?: Array<{ string?: string }>; name?: Array<{ string?: string }> }>; count?: number };

  console.log(`  Formula probe q=member_count → ${formulaProbeResp.count ?? 0} hits`);

  const escaped = 'member_count'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`);

  const matches: Array<{ _id: string; name: string; formula: string }> = [];
  const nonMatches: Array<{ _id: string; name: string; formula: string }> = [];

  for (const e of formulaProbeResp.entities ?? []) {
    const formula = e.formula?.[0]?.string ?? '';
    const name = e.name?.[0]?.string ?? '(unnamed)';
    if (wordBoundaryRegex.test(formula)) {
      matches.push({ _id: e._id, name, formula });
    } else {
      nonMatches.push({ _id: e._id, name, formula });
    }
  }

  console.log(`  Word-boundary matches (\\bmember_count\\b): ${matches.length}`);
  for (const m of matches) {
    console.log(`    _id: ${m._id}, name: ${m.name}`);
    console.log(`    formula: "${m.formula}"`);
    console.log(`    → WOULD BLOCK prop-def delete`);
  }

  console.log(`  Non-matches (q= hit but word-boundary rejected): ${nonMatches.length}`);
  for (const m of nonMatches) {
    console.log(`    _id: ${m._id}, name: ${m.name}`);
    console.log(`    formula: "${m.formula}"`);
    console.log(`    → correctly rejected by word-boundary filter`);
  }

  // Check if the prop-def itself still exists
  console.log(`\n  Checking prop-def entity ${MEMBER_COUNT_PROP_DEF_ID} still exists...`);
  try {
    const propDef = await get(jwt, `entity/${MEMBER_COUNT_PROP_DEF_ID}`) as {
      entity?: { _id: string; name?: Array<{ string?: string }>; formula?: Array<{ string?: string }> }
    };
    const defEntity = propDef.entity;
    if (defEntity) {
      console.log(`  prop-def exists: _id=${defEntity._id}, name=${defEntity.name?.[0]?.string ?? '(none)'}`);
    } else {
      console.log('  prop-def entity response has no entity field — may be deleted already');
    }
  } catch (err) {
    console.log(`  prop-def fetch error: ${err}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  console.log(`Op #1 org.contact_email: ${orgsWithContactEmail.length} orgs still have values — BLOCKED (needs instance data clear)`);
  console.log(`Op #2 org.org_type: ${orgsWithOrgType.length} orgs still have values — BLOCKED (needs instance data clear)`);
  console.log(`Op #3 member.joined_at: ${membersWithJoinedAt.length} members still have values — BLOCKED (needs instance data clear)`);
  console.log(`Op #4 org.member_count: Probe 1 word-boundary matches = ${matches.length} → ${matches.length > 0 ? 'STILL BLOCKED' : 'FALSE POSITIVE CONFIRMED'}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
