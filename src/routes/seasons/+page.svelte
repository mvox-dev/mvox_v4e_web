<!-- src/routes/seasons/+page.svelte — conductor home -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { selectedOrgStore, userStore, decodeJwt } from '$lib/auth/userStore';
	import { getToken } from '$lib/auth/storage';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { seasonsStore, hydrateSeasons } from '$lib/seasons/seasonsStore';
	import {
		assignConductor,
		createSeason,
		createSeriesWithEvents,
		deleteRehearsal,
		deleteSeriesCascade,
		DeleteForbiddenError,
		listConductors,
		listOrgMembers,
		listRehearsals,
		listSeries,
		PartialGenerationError,
		revokeConductor,
		updateSeason,
		updateRehearsal,
	} from '$lib/seasons/entuSeasons';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import SeasonBar from '$lib/components/seasons/SeasonBar.svelte';
	import SeasonForm from '$lib/components/seasons/SeasonForm.svelte';
	import ConductorPanel from '$lib/components/seasons/ConductorPanel.svelte';
	import SeriesForm from '$lib/components/seasons/SeriesForm.svelte';
	import RehearsalList from '$lib/components/seasons/RehearsalList.svelte';
	import RehearsalEditForm from '$lib/components/seasons/RehearsalEditForm.svelte';
	import type { Conductor, OrgMember, Rehearsal, Season } from '$lib/seasons/types';
	import type { SeasonPatch } from '$lib/seasons/entuSeasons';

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

	// ── Conductor list + org-member picker — reactive on season + org change ────
	$effect(() => {
		const season = selectedSeason;
		const org = $selectedOrgStore;
		if (!season || !org) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		Promise.resolve(listConductors(cfg, season.id))
			.then((list) => { if (list) conductors = list; })
			.catch(() => {});
		Promise.resolve(listOrgMembers(cfg, org.id))
			.then((list) => { if (list) orgMembers = list; })
			.catch(() => {});
	});

	// ── Rehearsals + series names — reactive on season + org change ──────────────
	$effect(() => {
		const season = selectedSeason;
		const org = $selectedOrgStore;
		if (!season || !org) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		Promise.resolve(listRehearsals(cfg, { orgId: org.id, seasonId: season.id }))
			.then((list) => { if (list) rehearsals = list; })
			.catch(() => {});
		Promise.resolve(listSeries(cfg, season.id))
			.then((list) => {
				if (list) seriesNames = new Map(list.map((s) => [s.id, s.name]));
			})
			.catch(() => {});
	});

	let rehearsals = $state<Rehearsal[]>([]);
	let seriesNames = $state(new Map<string, string>());
	let orgMembers = $state<OrgMember[]>([]);
	let conductors = $state<Conductor[]>([]);

	// ── Notice: partial-generation / partial-delete / update feedback ────────
	let notice = $state<string | null>(null);

	// ── Panel mode: controls which SeasonForm (if any) is open ────────────────
	let panelMode = $state<'none' | 'create' | 'edit'>('none');
	// Per-rehearsal inline edit state (null = no form open).
	let editingRehearsalId = $state<string | null>(null);

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
		notice = null;
		let newId: string;
		try {
			newId = await createSeason(cfg, {
				orgId: org?.id ?? '',
				name: payload.name,
				startDate: payload.startDate,
				endDate: payload.endDate,
			});
		} catch {
			notice = m.seasons_notice_create_failed();
			return;
		}
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		await hydrateSeasons({ orgId: org?.id ?? '', personId: personId ?? '', token });
		// Auto-select the new season and close the create panel.
		panelMode = 'none';
		selectSeason(newId);
	}

	async function handleSeasonEdit(patch: SeasonPatch) {
		const season = selectedSeason;
		if (!season) return;
		const org = $selectedOrgStore;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		notice = null;
		try {
			await updateSeason(cfg, season.id, patch);
		} catch {
			notice = m.seasons_notice_update_failed();
			return;
		}
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		await hydrateSeasons({ orgId: org?.id ?? '', personId: personId ?? '', token });
		panelMode = 'none';
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
		// Re-hydrate the season list (keeps the season selector in sync).
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		await hydrateSeasons({ orgId: org?.id ?? '', personId: personId ?? '', token });

		// P0.6 retry window: poll listRehearsals until new events appear or 3 retries.
		// Rights cascade takes ~1.5–3.5s/level — poll count rather than seasons.length.
		const orgId = org?.id ?? '';
		const seasonId = season.id;
		const fetchRehearsals = () =>
			Promise.resolve(listRehearsals(cfg, { orgId, seasonId }))
				.then((list) => { if (list) rehearsals = list; return list ?? []; })
				.catch(() => []);
		let current = await fetchRehearsals();
		for (let i = 0; i < 3; i++) {
			if (current.length > 0) break;
			await new Promise((r) => setTimeout(r, 500));
			current = await fetchRehearsals();
		}
	}

	async function handleRehearsalCancel(rehearsalId: string) {
		const season = selectedSeason;
		const org = $selectedOrgStore;
		if (!season || !org) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		notice = null;
		try {
			await deleteRehearsal(cfg, rehearsalId);
		} catch (err) {
			if (err instanceof DeleteForbiddenError) {
				notice = m.seasons_notice_delete_forbidden();
				return;
			}
			throw err;
		}
		// Re-load the rehearsal list so the deleted row disappears.
		Promise.resolve(listRehearsals(cfg, { orgId: org.id, seasonId: season.id }))
			.then((list) => { if (list) rehearsals = list; })
			.catch(() => {});
	}

	function handleRehearsalEdit(id: string) {
		// Toggle: tapping edit again on the same rehearsal closes the form.
		editingRehearsalId = editingRehearsalId === id ? null : id;
	}

	async function handleRehearsalSave(rehearsalId: string, patch: import('$lib/seasons/entuSeasons').RehearsalPatch) {
		const season = selectedSeason;
		const org = $selectedOrgStore;
		if (!season || !org) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		notice = null;
		try {
			await updateRehearsal(cfg, rehearsalId, patch);
		} catch {
			notice = m.seasons_notice_update_failed();
			return;
		}
		editingRehearsalId = null;
		// Re-load the rehearsal list so the updated row reflects the new values.
		Promise.resolve(listRehearsals(cfg, { orgId: org.id, seasonId: season.id }))
			.then((list) => { if (list) rehearsals = list; })
			.catch(() => {});
	}

	async function handleDeleteSeries(seriesId: string) {
		const season = selectedSeason;
		const org = $selectedOrgStore;
		if (!season || !org) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		notice = null;
		let result;
		try {
			result = await deleteSeriesCascade(cfg, seriesId);
		} catch (err) {
			if (err instanceof DeleteForbiddenError) {
				notice = m.seasons_notice_delete_forbidden();
				return;
			}
			throw err;
		}
		if (!result.seriesDeleted) {
			// Partial failure — series still alive; surface a retry notice.
			notice = m.seasons_notice_partial_delete({ deleted: result.deleted, total: result.deleted });
		}
		// Re-load rehearsals and series regardless of partial/full — remove what was deleted.
		Promise.resolve(listRehearsals(cfg, { orgId: org.id, seasonId: season.id }))
			.then((list) => { if (list) rehearsals = list; })
			.catch(() => {});
		Promise.resolve(listSeries(cfg, season.id))
			.then((list) => {
				if (list) seriesNames = new Map(list.map((s) => [s.id, s.name]));
			})
			.catch(() => {});
	}

	async function handleConductorAssign(personId: string) {
		const season = selectedSeason;
		const org = $selectedOrgStore;
		if (!season || !org) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		notice = null;
		try {
			await assignConductor(cfg, { seasonId: season.id, orgId: org.id, personId });
		} catch (err) {
			if (err instanceof Error && /must be an org member/i.test(err.message)) {
				notice = m.seasons_notice_assign_not_member();
				return;
			}
			throw err;
		}
		conductors = await listConductors(cfg, season.id);
	}

	async function handleConductorRemove(personId: string) {
		const season = selectedSeason;
		if (!season) return;
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		await revokeConductor(cfg, { seasonId: season.id, personId });
		conductors = await listConductors(cfg, season.id);
	}
</script>

<DeskSurface>
	<div data-testid="seasons-page" class="page-wrap">

		<!-- Page header -->
		<div class="page-hdr">
			<div class="page-eyebrow">{m.seasons_eyebrow()}</div>
			<div class="page-title">{m.seasons_page_title()}</div>
		</div>

		<!-- Notice region -->
		{#if notice}
			<div data-testid="seasons-notice" class="notice">{notice}</div>
		{/if}

		<!-- Loading / error states -->
		{#if $seasonsStore.status === 'loading'}
			<div data-testid="seasons-loading" class="state-msg">{m.common_loading()}</div>
		{:else if $seasonsStore.status === 'error'}
			<div data-testid="seasons-error" class="state-msg">{m.common_error()}</div>
		{:else if $seasonsStore.status === 'no-rights'}
			<div data-testid="seasons-viewer" class="state-msg">{m.seasons_empty_no_seasons_viewer()}</div>
		{:else if $seasonsStore.status === 'ready' && $seasonsStore.seasons.length === 0}
			<!-- No seasons yet -->
			{#if canManage}
				<div data-testid="seasons-empty-owner" class="stacked-section">
					<p class="state-msg">{m.seasons_empty_no_seasons()}</p>
					{#if panelMode === 'create'}
						<div data-testid="season-form-wrap" class="form-wrap">
							<SeasonForm oncreate={handleSeasonCreate} />
						</div>
					{/if}
					<button
						data-testid="season-create-empty"
						type="button"
						class="inline-create-btn"
						aria-label={m.seasons_a11y_create_season()}
						onclick={() => { panelMode = 'create'; }}
					>+</button>
				</div>
			{:else}
				<div data-testid="seasons-empty-viewer" class="state-msg">{m.seasons_empty_no_seasons_viewer()}</div>
			{/if}
		{:else if $seasonsStore.status === 'ready'}
			<!-- SeasonBar: horizontal scrollable tag row with inline edit + create -->
			<SeasonBar
				seasons={$seasonsStore.seasons}
				selectedId={selectedSeasonId ?? ($seasonsStore.seasons[0]?.id ?? '')}
				{canManage}
				editing={panelMode === 'edit'}
				onselect={selectSeason}
				onedit={() => { panelMode = panelMode === 'edit' ? 'none' : 'edit'; }}
				oncreate={() => { panelMode = 'create'; }}
			/>

			<!-- On-demand season panels (one at a time) -->
			{#if panelMode === 'create'}
				<div data-testid="season-form-wrap" class="stacked-section">
					<SeasonForm oncreate={handleSeasonCreate} />
				</div>
			{:else if panelMode === 'edit' && selectedSeason}
				<div data-testid="season-form-wrap" class="stacked-section">
					<SeasonForm season={selectedSeason} onupdate={handleSeasonEdit} />
				</div>
			{/if}

			<!-- Stacked full-width: conductor panel, series form, rehearsal list -->
			{#if canManage && selectedSeason}
				<div data-testid="owner-controls" class="stacked-section">
					<div data-testid="conductor-panel-wrap" class="panel-wrap">
						<ConductorPanel
							{conductors}
							members={orgMembers}
							{canManage}
							onassign={handleConductorAssign}
							onremove={handleConductorRemove}
						/>
					</div>
				</div>
			{/if}

			{#if selectedSeason}
				<div data-testid="series-form-wrap" class="stacked-section">
					<SeriesForm season={selectedSeason} oncreate={handleSeriesCreate} />
				</div>
				<div data-testid="rehearsal-list-wrap" class="stacked-section">
					<RehearsalList
						{rehearsals}
						{seriesNames}
						oncancel={handleRehearsalCancel}
						onedit={handleRehearsalEdit}
						{canManage}
						ondeleteseries={handleDeleteSeries}
					/>
				</div>
				{#if canManage && editingRehearsalId}
					{@const editRehearsal = rehearsals.find((r) => r.id === editingRehearsalId)}
					{#if editRehearsal}
						<div data-testid="rehearsal-edit-form-wrap" class="stacked-section">
							<RehearsalEditForm
								rehearsal={editRehearsal}
								onsave={(patch) => handleRehearsalSave(editingRehearsalId!, patch)}
								oncancel={() => { editingRehearsalId = null; }}
							/>
						</div>
					{/if}
				{/if}
			{:else}
				<div data-testid="no-season-selected" class="state-msg">
					{m.seasons_empty_no_seasons()}
				</div>
			{/if}
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
	/* Stacked full-width sections — mobile-first, no horizontal squish */
	.stacked-section {
		padding: 12px 16px;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
	}
	.form-wrap, .panel-wrap {
		display: contents;
	}
	.inline-create-btn {
		font-size: 16px;
		padding: 2px 10px;
		border: 1.5px solid #b8a986;
		border-radius: 14px;
		background: #fbf9f3;
		color: #6a5230;
		cursor: pointer;
		font-family: inherit;
		margin-top: 8px;
	}
</style>
