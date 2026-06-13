<!-- src/routes/agenda/+page.svelte — singer unified agenda + RSVP -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { userStore } from '$lib/auth/userStore';
	import { getToken } from '$lib/auth/storage';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { listAgenda } from '$lib/agenda/agendaData';
	import type { AgendaItem, AgendaResult } from '$lib/agenda/agendaData';
	import {
		listMyRsvps,
		findMyMemberId,
		createRsvp,
		updateRsvpStatus,
		deleteRsvp,
		applyTallyDelta,
	} from '$lib/rsvp/rsvpData';
	import type { MyRsvp, RsvpStatus, RsvpTally } from '$lib/rsvp/rsvpData';
	import AgendaList from '$lib/components/agenda/AgendaList.svelte';
	import DeskSurface from '$lib/components/DeskSurface.svelte';

	// ── Agenda + RSVP state ──────────────────────────────────────────────────────
	let result = $state<AgendaResult | null>(null);
	// eventId → MyRsvp (from listMyRsvps)
	let rsvpMap = $state(new Map<string, MyRsvp>());
	// orgId → memberId | null (from findMyMemberId per org)
	let memberMap = $state(new Map<string, string | null>());
	// Per-item row-level error (itemId → error message | null)
	let rowErrors = $state(new Map<string, string>());
	// itemId → optimistically-updated tally — overrides item.tally for display
	let tallyMap = $state(new Map<string, RsvpTally>());

	// ── Hydrate when user becomes ready — YELLOW-10.1 staleness guard ────────────
	// A monotonically-increasing request counter guards against stale completions:
	// if the effect re-runs (user store changes), any in-flight promise from the
	// previous run is ignored when it eventually resolves.
	let currentRequestId = 0;

	$effect(() => {
		const user = $userStore;
		if (user.status !== 'ready') return;
		if (user.orgs.length === 0) return; // no-orgs state — nothing to fetch

		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		const personId = user.personId;

		// Stamp THIS call's id before any async work
		const myId = ++currentRequestId;

		// ── Phase 1: listAgenda ──────────────────────────────────────────────────
		listAgenda(cfg, user.orgs, new Date())
			.then((r) => {
				// Staleness guard: if a newer call already resolved, discard this one
				if (myId !== currentRequestId) return;
				result = r;
				// Seed tallyMap from the freshly-loaded items (clears any prior optimistic state)
				tallyMap = new Map(r.items.map((item) => [item.id, { ...item.tally }]));

				// ── Phase 2: parallel RSVP + member lookups after agenda resolves ──
				const distinctOrgIds = [...new Set(r.items.map((item) => item.orgId))];

				Promise.all([
					listMyRsvps(cfg, personId).then((rsvps) => {
						if (myId !== currentRequestId) return;
						const m = new Map<string, MyRsvp>();
						for (const rsvp of rsvps) m.set(rsvp.eventId, rsvp);
						rsvpMap = m;
					}),
					...distinctOrgIds.map((orgId) =>
						findMyMemberId(cfg, personId, orgId).then((memberId) => {
							if (myId !== currentRequestId) return;
							// Assign new Map to trigger reactivity
							memberMap = new Map([...memberMap, [orgId, memberId]]);
						}),
					),
				]).catch(() => {
					// RSVP load failure is non-fatal — agenda content still shows
				});
			})
			.catch(() => {
				if (myId !== currentRequestId) return;
				result = { items: [], errors: user.orgs.map((o) => o.label) };
			});
	});

	// ── RSVP change handler: optimistic update + revert-on-error ─────────────────
	async function handleRsvpChange(item: AgendaItem, newStatus: RsvpStatus | null) {
		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };

		// Read current state for optimistic bookkeeping
		const existing = rsvpMap.get(item.id) ?? null;
		const memberId = memberMap.get(item.orgId) ?? null;
		const oldStatus = existing?.status ?? null;

		// Capture current tally for potential revert
		const currentTally = tallyMap.get(item.id) ?? { ...item.tally };

		// ── Optimistic RSVP status update ───────────────────────────────────────
		const nextMap = new Map(rsvpMap);
		if (newStatus === null) {
			nextMap.delete(item.id);
		} else {
			nextMap.set(item.id, {
				rsvpId: existing?.rsvpId ?? '__optimistic__',
				eventId: item.id,
				status: newStatus,
			});
		}
		rsvpMap = nextMap;

		// ── Optimistic tally delta ───────────────────────────────────────────────
		tallyMap = new Map([
			...tallyMap,
			[item.id, applyTallyDelta(currentTally, oldStatus, newStatus)],
		]);

		// Clear any prior row error
		const nextErrors = new Map(rowErrors);
		nextErrors.delete(item.id);
		rowErrors = nextErrors;

		try {
			if (newStatus === null && existing) {
				// Delete
				await deleteRsvp(cfg, existing.rsvpId);
			} else if (newStatus !== null && existing) {
				// Update
				await updateRsvpStatus(cfg, existing.rsvpId, newStatus);
			} else if (newStatus !== null && !existing) {
				// Create — needs memberId
				if (!memberId) throw new Error('no member');
				const user = $userStore;
				const personId = user.status === 'ready' ? user.personId : '';
				const newId = await createRsvp(cfg, {
					personId,
					eventId: item.id,
					memberId,
					status: newStatus,
				});
				// Replace optimistic entry with real id
				rsvpMap = new Map([
					...rsvpMap,
					[item.id, { rsvpId: newId, eventId: item.id, status: newStatus }],
				]);
			}
		} catch {
			// Revert RSVP status to previous state
			const revertMap = new Map(rsvpMap);
			if (existing) {
				revertMap.set(item.id, existing);
			} else {
				revertMap.delete(item.id);
			}
			rsvpMap = revertMap;
			// Revert tally to pre-change value
			tallyMap = new Map([...tallyMap, [item.id, currentTally]]);
			// Surface row-level error
			rowErrors = new Map([...rowErrors, [item.id, m.rsvp_error()]]);
		}
	}
</script>

<DeskSurface>
	<div data-testid="agenda-page" class="page-wrap">

		<!-- Page header -->
		<div class="page-hdr">
			<div class="page-title" data-desk-text>{m.agenda_title()}</div>
		</div>

		<!-- Loading state -->
		{#if $userStore.status === 'loading'}
			<div class="state-msg-container bg-paper">
				<div data-testid="agenda-loading" class="state-msg">{m.agenda_title()}</div>
			</div>

		<!-- Ready: no orgs -->
		{:else if $userStore.status === 'ready' && $userStore.orgs.length === 0}
			<div class="state-msg-container bg-paper">
				<div data-testid="agenda-empty-no-orgs" class="state-msg">
					{m.agenda_empty_no_orgs()}
				</div>
			</div>

		<!-- Ready: orgs present — show list (loading skeleton while result is null) -->
		{:else if $userStore.status === 'ready'}
			{#if result === null}
				<div class="state-msg-container bg-paper">
					<div data-testid="agenda-loading" class="state-msg">{m.agenda_title()}</div>
				</div>
			{:else}
				<div class="list-section">
					<AgendaList
						items={result.items}
						errors={result.errors}
						rsvpMap={rsvpMap}
						memberMap={memberMap}
						rowErrors={rowErrors}
						tallyMap={tallyMap}
						onrsvpchange={handleRsvpChange}
					/>
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

	.page-title {
		font-size: 30px;
		font-weight: 700;
		color: #2a2620;
		line-height: 1;
		letter-spacing: -0.01em;
		margin-top: 2px;
	}

	.state-msg-container {
		margin: 12px 16px;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.state-msg {
		padding: 20px 28px;
		font-size: 12px;
		color: #998a6a;
		font-style: italic;
	}

	.list-section {
		padding: 12px 16px;
	}
</style>
