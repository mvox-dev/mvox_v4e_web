<!-- src/lib/components/seasons/RehearsalList.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Rehearsal } from '$lib/seasons/types';
	import RsvpTallyBadge from '$lib/components/agenda/RsvpTallyBadge.svelte';

	interface Props {
		/** Rehearsals to display, pre-sorted by start_datetime asc. */
		rehearsals: Rehearsal[];
		/**
		 * Series-name lookup keyed by seriesId — used by GREEN to render group headers.
		 * Stub renders rows only; grouping wired in GREEN.
		 */
		seriesNames: Map<string, string>;
		/** Called when the user confirms cancelling one rehearsal (delete). */
		oncancel: (rehearsalId: string) => void;
		/** Called when the user opens the edit form for one rehearsal. */
		onedit: (rehearsalId: string) => void;
		/** When true, shows the series-delete button in each group header. */
		canManage?: boolean;
		/** Called when the owner deletes an entire series. */
		ondeleteseries?: (seriesId: string) => void;
	}
	let { rehearsals, seriesNames, oncancel, onedit, canManage = false, ondeleteseries }: Props = $props();

	/** Group rehearsals by seriesId, preserving the original sort order of first appearance. */
	const groups = $derived.by(() => {
		const seen = new Map<string, Rehearsal[]>();
		const order: string[] = [];
		for (const r of rehearsals) {
			if (!seen.has(r.seriesId)) {
				seen.set(r.seriesId, []);
				order.push(r.seriesId);
			}
			seen.get(r.seriesId)!.push(r);
		}
		return order.map((sid) => ({ seriesId: sid, rows: seen.get(sid)! }));
	});

	const now = new Date().toISOString();
</script>

<div data-testid="rehearsal-list" class="list-wrap">
	{#each groups as group (group.seriesId)}
		<div data-testid="rehearsal-series-card" class="series-card bg-paper">
			<div class="group-header-row">
				<div data-testid="rehearsal-group-header" class="group-header">
					{seriesNames.get(group.seriesId) ?? group.seriesId}
				</div>
				{#if canManage && ondeleteseries}
					<button
						data-testid="series-delete"
						type="button"
						class="series-del-btn"
						onclick={() => {
							if (!window.confirm(m.seasons_confirm_delete_series_body({ n: group.rows.length }))) return;
							ondeleteseries!(group.seriesId);
						}}
					>
						{m.seasons_actions_delete()}
					</button>
				{/if}
			</div>
		{#each group.rows as rehearsal (rehearsal.id)}
			<div
				data-testid="rehearsal-row"
				data-rehearsal-id={rehearsal.id}
				class="row"
				class:muted={rehearsal.startDatetime < now}
			>
				<span data-testid="rehearsal-datetime" class="row-datetime">
					{rehearsal.startDatetime}
				</span>
				<span data-testid="rehearsal-duration" class="row-duration">
					{rehearsal.durationMinutes}
				</span>
				<RsvpTallyBadge tally={rehearsal.tally} />
				<span data-testid="rehearsal-location" class="row-location">
					{rehearsal.location ?? '—'}
				</span>
				{#if canManage}
					<button
						data-testid="rehearsal-edit"
						type="button"
						class="row-btn"
						onclick={() => onedit(rehearsal.id)}
					>
						{m.seasons_actions_edit()}
					</button>
				{/if}
				<button
					data-testid="rehearsal-cancel"
					type="button"
					class="row-btn"
					onclick={() => {
						if (!window.confirm(m.seasons_confirm_cancel_rehearsal_body())) return;
						oncancel(rehearsal.id);
					}}
				>
					{m.seasons_actions_delete()}
				</button>
			</div>
		{/each}
		</div><!-- end rehearsal-series-card -->
	{/each}

	{#if rehearsals.length === 0}
		<div data-testid="rehearsal-empty" class="empty-state bg-paper">
			<p class="empty-text">{m.seasons_empty_no_rehearsals()}</p>
			<button data-testid="rehearsal-empty-cta" type="button" class="empty-cta">
				{m.seasons_empty_no_rehearsals_cta()}
			</button>
		</div>
	{/if}
</div>

<style>
	.list-wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.series-card {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 4px;
		padding: 10px 12px;
	}

	.group-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 0 3px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.12);
		margin-bottom: 2px;
	}
	.group-header {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		color: #6a5230;
	}
	.series-del-btn {
		font-size: 10px;
		color: #c0392b;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 0;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
		font-size: 11px;
	}
	.row-datetime {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: #2a2620;
		flex-shrink: 0;
	}
	.row-duration {
		font-size: 10px;
		color: #6a5230;
		flex-shrink: 0;
	}
	.row-location {
		flex: 1;
		font-size: 10px;
		color: #6a5230;
		min-width: 0;
	}
	.row-btn {
		font-size: 10px;
		color: #6a5230;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
		flex-shrink: 0;
	}
	.muted {
		opacity: 0.45;
	}
	.empty-state {
		padding: 20px 0;
		text-align: center;
	}
	.empty-text {
		font-size: 12px;
		color: #998a6a;
		font-style: italic;
		margin: 0 0 8px;
	}
	.empty-cta {
		font-size: 11px;
		color: #6a5230;
		background: none;
		border: 1px solid #b8a986;
		border-radius: 2px;
		padding: 4px 10px;
		cursor: pointer;
		font-family: inherit;
	}
</style>
