/**
 * probe-agenda-empty-investigation-2026-08-06.ts
 *
 * T5 agenda now loads cleanly for the PO but shows "No upcoming rehearsals".
 * Read-only investigation: is that correct (no upcoming data / off-season) or
 * a bug (data exists but hidden by rights / a query mismatch)?
 *
 * Mirrors exactly what the browser does (per team-lead's dispatch):
 *   Seasons: entity?_type.string=season&props=name,start_date,end_date&limit=200
 *     "ongoing" = endDate empty('') OR endDate>=today
 *   Rehearsals per season: entity?_type.string=event&event_type.string=rehearsal
 *     &_parent.reference=<seasonId>&props=name,start_datetime,duration_minutes,location,_parent&limit=500
 *     kept if start_datetime >= now; location/duration merged from event_series parent
 *     (found via _parent[].entity_type==='event_series', prop default_location)
 *
 * Run with ENTU_API_KEY = PO's key (db-owner, omniscient) so results are not
 * confounded by rights — this establishes ground truth first. READ-ONLY. No mutations.
 *
 * Run: npx tsx scripts/migrations/probes/probe-agenda-empty-investigation-2026-08-06.ts
 */

import { getJwt } from '../lib/entu-client.ts';
import { writeResultArtifact } from '../perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const PO_PERSON_ID = '6a2fc05e4cd971291c5d5ddc';
const SEASON_IDS = ['6a1d6b6210cc20db24e7ce58', '6a1d789c10cc20db24e7cf40'];
const NOW = new Date();

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

function extractSharingRights(entity: Record<string, unknown>) {
	const pick = (key: string) => (Array.isArray(entity[key]) ? entity[key] : []);
	return {
		sharing: (pick('_sharing')[0] as any)?.string ?? 'ABSENT',
		inheritRights: (pick('_inheritrights')[0] as any)?.boolean ?? 'ABSENT',
		viewer: (pick('_viewer') as any[]).map((v) => ({ reference: v.reference, inherited: v.inherited ?? null })),
	};
}

async function main() {
	const result: Record<string, unknown> = { timestamp: NOW.toISOString(), poPersonId: PO_PERSON_ID };

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const h = { Authorization: `Bearer ${jwt}` };

	section('1. Seasons — name/start_date/end_date + rights');
	const seasons: Record<string, unknown>[] = [];
	for (const id of SEASON_IDS) {
		const url = `${API_BASE}/${DB}/entity/${id}?props=name,start_date,end_date,_sharing,_inheritrights,_viewer`;
		const body = (await (await fetch(url, { headers: h })).json()) as { entity?: Record<string, unknown> };
		const e = body.entity ?? {};
		const name = (e.name as any)?.[0]?.string ?? null;
		const startDate = (e.start_date as any)?.[0]?.date ?? null;
		const endDate = (e.end_date as any)?.[0]?.date ?? null;
		const isOngoing = !endDate || new Date(endDate) >= NOW;
		const rights = extractSharingRights(e);
		const poCanView = rights.viewer.some((v: any) => v.reference === PO_PERSON_ID);
		log(
			`season ${id}: name="${name}" start=${startDate} end=${endDate} ongoing=${isOngoing} ` +
				`sharing=${rights.sharing} inheritRights=${rights.inheritRights} poInViewer=${poCanView}`,
		);
		seasons.push({ id, name, startDate, endDate, isOngoing, rights, poCanView });
	}
	result.seasons = seasons;

	section('2. Rehearsal events per season — start_datetime vs now');
	const eventsBySeasonn: Record<string, unknown[]> = {};
	for (const id of SEASON_IDS) {
		const url =
			`${API_BASE}/${DB}/entity?_type.string=event&event_type.string=rehearsal` +
			`&_parent.reference=${id}&props=name,start_datetime,duration_minutes,location,_parent,_sharing,_inheritrights&limit=500`;
		const body = (await (await fetch(url, { headers: h })).json()) as {
			entities?: Record<string, unknown>[];
			count?: number;
		};
		const events = body.entities ?? [];
		log(`season ${id}: ${events.length} rehearsal event(s) (api count=${body.count ?? 'n/a'})`);
		const detailed = events.map((e) => {
			const name = (e.name as any)?.[0]?.string ?? null;
			const startDatetime = (e.start_datetime as any)?.[0]?.datetime ?? (e.start_datetime as any)?.[0]?.date ?? null;
			const isFuture = startDatetime ? new Date(startDatetime) >= NOW : null;
			const parents = (e._parent as any[]) ?? [];
			const seriesParent = parents.find((p) => p.entity_type === 'event_series');
			return {
				id: e._id,
				name,
				startDatetime,
				isFuture,
				location: (e.location as any)?.[0]?.string ?? null,
				durationMinutes: (e.duration_minutes as any)?.[0]?.number ?? null,
				seriesParentRef: seriesParent?.reference ?? null,
				rights: extractSharingRights(e),
			};
		});
		for (const d of detailed) {
			log(
				`  event ${d.id}: "${d.name}" start=${d.startDatetime} isFuture=${d.isFuture} ` +
					`location=${d.location} seriesParent=${d.seriesParentRef}`,
			);
		}
		eventsBySeasonn[id] = detailed;
	}
	result.eventsBySeason = eventsBySeasonn;

	const allEvents = Object.values(eventsBySeasonn).flat() as any[];
	result.totalEventsAllSeasons = allEvents.length;
	result.futureEventsAllSeasons = allEvents.filter((e) => e.isFuture).length;

	section('3. event_series entities (default_location)');
	const seriesUrl = `${API_BASE}/${DB}/entity?_type.string=event_series&props=name,default_location,_parent,_sharing,_inheritrights&limit=200`;
	const seriesBody = (await (await fetch(seriesUrl, { headers: h })).json()) as {
		entities?: Record<string, unknown>[];
		count?: number;
	};
	const seriesList = (seriesBody.entities ?? []).map((s) => ({
		id: s._id,
		name: (s.name as any)?.[0]?.string ?? null,
		defaultLocation: (s.default_location as any)?.[0]?.string ?? null,
		parentRef: (s._parent as any[])?.[0]?.reference ?? null,
		rights: extractSharingRights(s),
	}));
	log(`event_series total: ${seriesList.length} (api count=${seriesBody.count ?? 'n/a'})`);
	for (const s of seriesList) log(`  series ${s.id}: "${s.name}" default_location=${s.defaultLocation}`);
	result.eventSeries = seriesList;

	section('4. Verdict inputs');
	const anyOngoingSeason = seasons.some((s: any) => s.isOngoing);
	const anyFutureEvent = allEvents.some((e) => e.isFuture);
	log(`anyOngoingSeason=${anyOngoingSeason} totalEvents=${allEvents.length} anyFutureEvent=${anyFutureEvent}`);
	result.verdictInputs = { anyOngoingSeason, totalEvents: allEvents.length, anyFutureEvent };

	writeResultArtifact('agenda-empty-investigation', result);
	log('done');
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
