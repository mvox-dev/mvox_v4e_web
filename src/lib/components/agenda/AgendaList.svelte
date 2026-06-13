<!-- src/lib/components/agenda/AgendaList.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AgendaItem } from '$lib/agenda/agendaData';
	import type { MyRsvp, RsvpStatus, RsvpTally } from '$lib/rsvp/rsvpData';
	import RsvpControl from './RsvpControl.svelte';
	import RsvpTallyBadge from './RsvpTallyBadge.svelte';

	interface Props {
		items: AgendaItem[];
		errors?: string[];
		/** eventId → MyRsvp — provided by the page after RSVP load. */
		rsvpMap?: Map<string, MyRsvp>;
		/** orgId → memberId|null — provided after member-id lookup per org. */
		memberMap?: Map<string, string | null>;
		/** itemId → error message — row-level RSVP errors surfaced by the page. */
		rowErrors?: Map<string, string>;
		/** itemId → optimistically-updated RsvpTally — overrides item.tally for display. */
		tallyMap?: Map<string, RsvpTally>;
		/** Called when the user changes (or clears) the RSVP on a row. */
		onrsvpchange?: (item: AgendaItem, newStatus: RsvpStatus | null) => void;
	}
	const {
		items,
		errors = [],
		rsvpMap = new Map(),
		memberMap = new Map(),
		rowErrors = new Map(),
		tallyMap = new Map(),
		onrsvpchange,
	}: Props = $props();

	// Tallinn IANA timezone — Europe/Tallinn (UTC+3 in summer, UTC+2 in winter)
	const TZ = 'Europe/Tallinn';

	// Grouping key: YYYY-MM-DD in Tallinn calendar day (en-CA gives ISO date format)
	const groupKeyFmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	// Locale-aware long header text: "Monday, 15 June" (locale of the browser)
	const headerFmt = new Intl.DateTimeFormat(undefined, {
		timeZone: TZ,
		weekday: 'long',
		day: 'numeric',
		month: 'long',
	});

	// Time-of-day HH:MM (24h, Tallinn)
	const timeFmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: TZ,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	/** Group items by Tallinn calendar date, preserving chronological order. */
	const groups = $derived.by(() => {
		const seen = new Map<string, AgendaItem[]>();
		const order: string[] = [];
		for (const item of items) {
			const d = new Date(item.startDatetime);
			const key = groupKeyFmt.format(d);
			if (!seen.has(key)) {
				seen.set(key, []);
				order.push(key);
			}
			seen.get(key)!.push(item);
		}
		return order.map((key) => ({
			key,
			header: headerFmt.format(new Date(key + 'T12:00:00')), // noon avoids DST edge on the key date
			rows: seen.get(key)!,
		}));
	});
</script>

<div data-testid="agenda-list" class="list-wrap">
	{#if errors.length > 0}
		<div data-testid="agenda-partial-error" class="partial-error">
			{m.agenda_partial_error({ orgs: errors.join(', ') })}
		</div>
	{/if}

	{#if items.length === 0}
		<div data-testid="agenda-empty" class="empty-state">
			<p class="empty-text">{m.agenda_empty_no_rehearsals()}</p>
		</div>
	{:else}
		{#each groups as group (group.key)}
			<div data-testid="agenda-day-card" class="day-card bg-paper">
				<div data-testid="agenda-date-header" class="date-header">
					{group.header}
				</div>
			{#each group.rows as item (item.id)}
				{@const rsvp = rsvpMap.get(item.id) ?? null}
				{@const memberId = memberMap.get(item.orgId)}
				{@const memberResolved = memberMap.has(item.orgId)}
				{@const rowError = rowErrors.get(item.id) ?? null}
				<div data-testid="agenda-row-{item.id}" class="row">
					<div class="row-main">
						<span data-testid="row-time" class="row-time">
							{timeFmt.format(new Date(item.startDatetime))}
						</span>
						<span data-testid="row-duration" class="row-duration">
							{m.agenda_duration_min({ minutes: item.durationMinutes })}
						</span>
						<span class="row-name">{item.name ?? ''}</span>
						<span data-testid="agenda-org-chip" class="org-chip">{item.orgLabel}</span>
						{#if item.location}
							<span data-testid="row-location" class="row-location">{item.location}</span>
						{/if}
						<RsvpTallyBadge tally={tallyMap.get(item.id) ?? item.tally} />
					</div>
					{#if memberResolved}
						<div class="row-rsvp">
							<RsvpControl
								status={rsvp?.status ?? null}
								disabled={memberId === null}
								onchange={(s) => onrsvpchange?.(item, s)}
							/>
						</div>
					{/if}
					{#if rowError}
						<div data-testid="agenda-row-error-{item.id}" class="row-error">{rowError}</div>
					{/if}
				</div>
			{/each}
			</div><!-- end agenda-day-card -->
		{/each}
	{/if}
</div>

<style>
	.list-wrap {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.day-card {
		border-radius: 6px;
		padding: 10px 14px;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.partial-error {
		margin-bottom: 10px;
		padding: 8px 12px;
		background: #fef3cd;
		border: 1px solid #e0c060;
		border-radius: 3px;
		font-size: 11px;
		color: #4a3a1f;
	}

	.date-header {
		padding: 10px 0 3px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.12);
		margin-bottom: 2px;
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		color: #6a5230;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 0;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
	}

	.row-main {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 11px;
	}

	.row-time {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: #2a2620;
		flex-shrink: 0;
	}

	.row-duration {
		font-size: 10px;
		color: #998a6a;
		flex-shrink: 0;
	}

	.row-name {
		flex: 1;
		font-size: 11px;
		color: #2a2620;
		min-width: 0;
	}

	.org-chip {
		font-size: 9px;
		letter-spacing: 0.06em;
		font-weight: 600;
		color: #293556;
		background: rgba(41, 53, 86, 0.08);
		border: 1px solid rgba(41, 53, 86, 0.18);
		border-radius: 3px;
		padding: 1px 5px;
		flex-shrink: 0;
	}

	.row-location {
		font-size: 10px;
		color: #6a5230;
		flex-shrink: 0;
	}

	.row-rsvp {
		padding-left: 2px;
	}

	.row-error {
		font-size: 10px;
		color: #c0392b;
		font-style: italic;
	}

	.empty-state {
		padding: 20px 0;
		text-align: center;
	}

	.empty-text {
		font-size: 12px;
		color: #998a6a;
		font-style: italic;
		margin: 0;
	}
</style>
