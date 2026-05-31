<!-- src/lib/components/landing/LandingDashboardScatter.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { librarySectionStore, hydrateLibrarySection } from '$lib/library/libraryStore';
	import { getToken } from '$lib/auth/storage';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { userStore, selectedOrgStore, decodeJwt } from '$lib/auth/userStore';
	import DashboardPillarCard from './DashboardPillarCard.svelte';

	type Props = { orgInitials: string };
	let { orgInitials }: Props = $props();

	$effect(() => {
		const org = $selectedOrgStore;
		const user = $userStore;
		if (!org || user.status !== 'ready') return;
		const token = getToken();
		if (!token) return;
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		if (!personId) return;
		hydrateLibrarySection({ orgId: org.id, personId });
	});

	const libraryMeta = $derived.by(() => {
		const state = $librarySectionStore;
		if (state.status === 'loading' || state.status === 'no-rights' || state.status === 'error') {
			return m.landing_dashboard_library_meta_loading();
		}
		if (state.status === 'empty') {
			return m.landing_dashboard_library_meta_empty();
		}
		// status === 'ready'
		const worksCount = state.works.length;
		const copiesCount = Array.from(state.editionsByWork.values()).reduce((sum, eds) => sum + eds.length, 0);
		const overdueCount = 0; // TODO: source overdue count from copies once lending data is wired (out of scope for CHORE-72)
		// rendered meta — overdue highlighted in red+bold ONLY when > 0
		const overdueFragment =
			overdueCount > 0
				? `<span class="text-red font-semibold">${overdueCount} overdue</span>`
				: `${overdueCount} overdue`;
		return m
			.landing_dashboard_library_meta_ready({ worksCount, copiesCount, overdueCount })
			.replace(`${overdueCount} overdue`, overdueFragment);
	});

	const libraryLbl = $derived(m.landing_dashboard_library_lbl({ org: orgInitials }));
</script>

<div data-testid="landing-dashboard-scatter" class="absolute top-[182px] left-0 right-0 bottom-0 px-4">
	<div style="position: absolute; top: 0; left: 22px; width: 260px;">
		<DashboardPillarCard variant="library" status="shipped" href="/library" lbl={libraryLbl} meta={libraryMeta} />
	</div>
	<div style="position: absolute; top: 100px; right: 18px; width: 220px;">
		<DashboardPillarCard variant="roster" status="indev" lbl={m.landing_dashboard_roster_lbl()} meta={m.landing_dashboard_pillar_meta_indev()} />
	</div>
	<div style="position: absolute; top: 220px; left: 14px; width: 220px;">
		<DashboardPillarCard variant="notes" status="coming" lbl={m.landing_dashboard_notes_lbl()} meta={m.landing_dashboard_pillar_meta_coming()} />
	</div>
	<div style="position: absolute; top: 330px; right: 24px; width: 240px;">
		<DashboardPillarCard variant="repertoire" status="coming" lbl={m.landing_dashboard_repertoire_lbl()} meta={m.landing_dashboard_pillar_meta_coming()} />
	</div>
</div>
