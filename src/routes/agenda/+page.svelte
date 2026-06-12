<!-- src/routes/agenda/+page.svelte — singer unified agenda -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { userStore } from '$lib/auth/userStore';
	import { getToken } from '$lib/auth/storage';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { listAgenda } from '$lib/agenda/agendaData';
	import type { AgendaResult } from '$lib/agenda/agendaData';
	import AgendaList from '$lib/components/agenda/AgendaList.svelte';
	import DeskSurface from '$lib/components/DeskSurface.svelte';

	// ── Reactive agenda result state ────────────────────────────────────────────
	let result = $state<AgendaResult | null>(null);

	// ── Hydrate when user becomes ready ─────────────────────────────────────────
	$effect(() => {
		const user = $userStore;
		if (user.status !== 'ready') return;
		if (user.orgs.length === 0) return; // no-orgs state — nothing to fetch

		const token = getToken() ?? '';
		const cfg = { db: PUBLIC_ENTU_DB, token };
		listAgenda(cfg, user.orgs, new Date())
			.then((r) => {
				result = r;
			})
			.catch(() => {
				result = { items: [], errors: user.orgs.map((o) => o.label) };
			});
	});
</script>

<DeskSurface>
	<div data-testid="agenda-page" class="page-wrap">

		<!-- Page header -->
		<div class="page-hdr">
			<div class="page-title">{m.agenda_title()}</div>
		</div>

		<!-- Loading state -->
		{#if $userStore.status === 'loading'}
			<div data-testid="agenda-loading" class="state-msg">{m.agenda_title()}</div>

		<!-- Ready: no orgs -->
		{:else if $userStore.status === 'ready' && $userStore.orgs.length === 0}
			<div data-testid="agenda-empty-no-orgs" class="state-msg">
				{m.agenda_empty_no_orgs()}
			</div>

		<!-- Ready: orgs present — show list (even while result is null / still loading) -->
		{:else if $userStore.status === 'ready'}
			{#if result === null}
				<div data-testid="agenda-loading" class="state-msg">{m.agenda_title()}</div>
			{:else}
				<div class="list-section">
					<AgendaList items={result.items} errors={result.errors} />
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
