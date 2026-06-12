import type { Org } from '$lib/auth/types';
import type { Rehearsal } from '$lib/seasons/types';
import type { EntuCfg } from '$lib/seasons/entuSeasons';
import { listSeasons, listRehearsals } from '$lib/seasons/entuSeasons';

export interface AgendaItem extends Rehearsal {
	orgId: string;
	orgLabel: string;
}

export interface AgendaResult {
	items: AgendaItem[];
	errors: string[];
}

export async function listAgenda(cfg: EntuCfg, orgs: Org[], now: Date): Promise<AgendaResult> {
	if (orgs.length === 0) return { items: [], errors: [] };
	const today = now.toISOString().slice(0, 10);
	const nowIso = now.toISOString();
	const errors: string[] = [];

	const perOrg = await Promise.all(
		orgs.map(async (org): Promise<AgendaItem[]> => {
			try {
				const seasons = await listSeasons(cfg, org.id);
				const ongoing = seasons.filter((s) => s.endDate >= today);
				const lists = await Promise.all(
					ongoing.map((s) => listRehearsals(cfg, { orgId: org.id, seasonId: s.id })),
				);
				return lists.flat().map((r) => ({ ...r, orgId: org.id, orgLabel: org.label }));
			} catch {
				errors.push(org.label);
				return [];
			}
		}),
	);

	const items = perOrg
		.flat()
		.filter((r) => r.startDatetime >= nowIso)
		.sort((a, b) => a.startDatetime.localeCompare(b.startDatetime));
	return { items, errors };
}
