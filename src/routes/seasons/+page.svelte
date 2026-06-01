<!-- src/routes/seasons/+page.svelte — conductor home -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { selectedOrgStore, userStore, decodeJwt } from '$lib/auth/userStore';
	import { getToken } from '$lib/auth/storage';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { seasonsStore, hydrateSeasons } from '$lib/seasons/seasonsStore';
	import { createSeason, createSeriesWithEvents, PartialGenerationError } from '$lib/seasons/entuSeasons';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import SeasonForm from '$lib/components/seasons/SeasonForm.svelte';
	import ConductorPanel from '$lib/components/seasons/ConductorPanel.svelte';
	import SeriesForm from '$lib/components/seasons/SeriesForm.svelte';
	import RehearsalList from '$lib/components/seasons/RehearsalList.svelte';
	import type { Season, Rehearsal } from '$lib/seasons/types';
	import type { OrgMember } from '$lib/components/seasons/ConductorPanel.svelte';

	// ── URL param: ?season=<id> (URL-overrides-persisted — spec §6) ────────────
	let selectedSeasonId = $derived(page.url.searchParams.get('season'));

	// ── Hydrate seasons when org / user changes ────────────────────────────────
	$effect(() => {
		const org = $selectedOrgStore;
		const user = $userStore;
		if (!org || user.status !== 'ready') return;
		const token = getToken();
		if (!token) return;
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		if (!personId) return;
		hydrateSeasons({ orgId: org.id, personId, token });
	});

	// ── Derive the selected season from the store + URL param ──────────────────
	let selectedSeason = $derived.by((): Season | null => {
		const state = $seasonsStore;
		if (state.status !== 'ready') return null;
		if (!selectedSeasonId) return state.seasons[0] ?? null;
		return state.seasons.find((s) => s.id === selectedSeasonId) ?? null;
	});

	// ── canManage: owner-tier gating — role:'owner' is set by hydrateUserStore ──
	// selectedOrgStore carries the Org object; role==='owner' means the user holds
	// _owner on this org (set in userStore.ts ~101–109 during org hydration).
	// $derived so it recomputes reactively when the user switches orgs.
	const canManage = $derived($selectedOrgStore?.role === 'owner');

	// ── Stub: empty rehearsal + conductor state until GREEN wires entuSeasons ──
	let rehearsals = $state<Rehearsal[]>([]);
	let seriesNames = $state(new Map<string, string>());
	let orgMembers = $state<OrgMember[]>([]);
	let conductors = $state<import('$lib/seasons/types').Conductor[]>([]);

	// ── Notice: partial-generation / partial-delete (wired in GREEN) ──────────
	let notice = $state<string | null>(null);

	// ── Season selector: write ?season=<id> to URL ────────────────────────────
	function selectSeason(id: string) {
		const url = new URL(page.url.href);
		url.searchParams.set('season', id);
		goto(url.toString(), { replaceState: true });
	}

	async function handleSeasonCreate(payload: import('$lib/components/seasons/SeasonForm.svelte').SeasonCreatePayload) {
		const org = $selectedOrgStore;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		await createSeason(cfg, {
			orgId: org?.id ?? '',
			name: payload.name,
			startDate: payload.startDate,
			endDate: payload.endDate,
		});
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		await hydrateSeasons({ orgId: org?.id ?? '', personId: personId ?? '', token });
	}

	async function handleSeriesCreate(payload: import('$lib/components/seasons/SeriesForm.svelte').SeriesCreatePayload) {
		const season = selectedSeason;
		if (!season) return;
		const org = $selectedOrgStore;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		notice = null;
		try {
			await createSeriesWithEvents(cfg, {
				orgId: org?.id ?? '',
				seasonId: season.id,
				name: payload.name,
				intervalDays: payload.intervalDays,
				startTime: payload.startTime,
				durationMinutes: payload.durationMinutes,
				startDate: payload.startDate,
				endDate: payload.endDate,
				location: payload.location || undefined,
			});
		} catch (err) {
			if (err instanceof PartialGenerationError) {
				notice = m.seasons_notice_partial_generate({ created: err.createdCount, total: err.createdCount });
			} else {
				throw err;
			}
		}
		// P0.6 retry window: rights cascade takes ~1.5–3.5s/level after series create;
		// poll hydrateSeasons up to 3 times at 500ms intervals until new events appear.
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		const hydrateArgs = { orgId: org?.id ?? '', personId: personId ?? '', token };
		await hydrateSeasons(hydrateArgs);
		for (let i = 0; i < 3; i++) {
			const state = $seasonsStore;
			if (state.status === 'ready' && state.seasons.length > 0) break;
			await new Promise((r) => setTimeout(r, 500));
			await hydrateSeasons(hydrateArgs);
		}
	}

	function handleRehearsalCancel(_id: string) {
		// GREEN: deleteRehearsal + optimistic removal; surface DeleteForbiddenError
	}

	function handleRehearsalEdit(_id: string) {
		// GREEN: open inline edit form for the targeted rehearsal
	}

	function handleConductorAssign(_personId: string) {
		// GREEN: assignConductor + re-fetch conductor list
	}

	function handleConductorRemove(_propertyValueId: string) {
		// GREEN: revokeConductor + re-fetch conductor list
	}
</script>

<DeskSurface>
	<div data-testid="seasons-page" class="page-wrap">

		<!-- Page header -->
		<div class="page-hdr">
			<div class="page-eyebrow">{m.seasons_eyebrow()}</div>
			<div class="page-title">{m.seasons_page_title()}</div>
		</div>

		<!-- Season selector (rendered when seasons are available) -->
		{#if $seasonsStore.status === 'ready'}
			<div data-testid="season-selector" class="season-selector">
				{#each $seasonsStore.seasons as season (season.id)}
					<button
						data-testid="season-selector-item"
						type="button"
						class="season-chip"
						class:sel={selectedSeasonId === season.id}
						onclick={() => selectSeason(season.id)}
					>
						{season.name}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Notice region: partial-generation / partial-delete feedback -->
		{#if notice}
			<div data-testid="seasons-notice" class="notice">{notice}</div>
		{/if}

		<!-- Loading / error states (mirror library page) -->
		{#if $seasonsStore.status === 'loading'}
			<div data-testid="seasons-loading" class="state-msg">{m.common_loading()}</div>
		{:else if $seasonsStore.status === 'error'}
			<div data-testid="seasons-error" class="state-msg">{m.common_error()}</div>
		{:else if $seasonsStore.status === 'no-rights'}
			<div data-testid="seasons-viewer" class="state-msg">{m.seasons_empty_no_seasons_viewer()}</div>
		{:else if $seasonsStore.status === 'ready' && $seasonsStore.seasons.length === 0}
			<!-- No seasons yet — show CTA to owner only -->
			{#if canManage}
				<div data-testid="seasons-empty-owner" class="create-panel">
					<p class="state-msg">{m.seasons_empty_no_seasons()}</p>
					<div data-testid="season-form-wrap" class="form-wrap">
						<SeasonForm oncreate={handleSeasonCreate} />
					</div>
				</div>
			{:else}
				<div data-testid="seasons-empty-viewer" class="state-msg">{m.seasons_empty_no_seasons_viewer()}</div>
			{/if}
		{:else if $seasonsStore.status === 'ready'}
			<!-- Main conductor view: season selected -->
			<div class="conductor-layout">

				<!-- Left column: owner controls (SeasonForm + ConductorPanel) -->
				{#if canManage}
					<div data-testid="owner-controls" class="owner-col">
						<div data-testid="season-form-wrap" class="form-wrap">
							<SeasonForm oncreate={handleSeasonCreate} />
						</div>
						{#if selectedSeason}
							<div data-testid="conductor-panel-wrap" class="panel-wrap">
								<ConductorPanel
									{conductors}
									members={orgMembers}
									{canManage}
									onassign={handleConductorAssign}
									onremove={handleConductorRemove}
								/>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Right column: series creation + rehearsal list -->
				<div class="content-col">
					{#if selectedSeason}
						<div data-testid="series-form-wrap" class="form-wrap">
							<SeriesForm season={selectedSeason} oncreate={handleSeriesCreate} />
						</div>
						<div data-testid="rehearsal-list-wrap" class="list-wrap">
							<RehearsalList
								{rehearsals}
								{seriesNames}
								oncancel={handleRehearsalCancel}
								onedit={handleRehearsalEdit}
							/>
						</div>
					{:else}
						<div data-testid="no-season-selected" class="state-msg">
							{m.seasons_empty_no_seasons()}
						</div>
					{/if}
				</div>
			</div>
		{/if}

	</div>
</DeskSurface>

<style>
	.page-wrap {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	.page-hdr {
		padding: 12px 28px 10px;
		background: rgba(251, 249, 243, 0.8);
		border-bottom: 1.5px solid #2a2620;
	}
	.page-eyebrow {
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #998a6a;
		font-weight: 600;
	}
	.page-title {
		font-size: 30px;
		font-weight: 700;
		color: #2a2620;
		line-height: 1;
		letter-spacing: -0.01em;
		margin-top: 2px;
	}
	.season-selector {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		padding: 10px 28px;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.15);
	}
	.season-chip {
		font-size: 11px;
		padding: 3px 10px;
		border: 1px solid #b8a986;
		border-radius: 2px;
		background: #fbf9f3;
		color: #2a2620;
		cursor: pointer;
		font-family: inherit;
	}
	.season-chip.sel {
		background: #2a2620;
		color: #fbf9f3;
		border-color: #2a2620;
	}
	.notice {
		margin: 10px 28px;
		padding: 8px 12px;
		background: #fef3cd;
		border: 1px solid #e0c060;
		border-radius: 3px;
		font-size: 11px;
		color: #4a3a1f;
	}
	.state-msg {
		padding: 20px 28px;
		font-size: 12px;
		color: #998a6a;
		font-style: italic;
	}
	.conductor-layout {
		display: flex;
		gap: 28px;
		padding: 20px 28px;
		align-items: flex-start;
	}
	.owner-col {
		flex-shrink: 0;
		width: 260px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.content-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.form-wrap, .panel-wrap, .list-wrap, .create-panel {
		display: contents;
	}
</style>
