<!-- src/lib/components/library/LibraryEditionCard.svelte -->
<script lang="ts">
	import type { EntuEdition } from '$lib/types/library-entu';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		edition: EntuEdition;
	}
	let { edition }: Props = $props();
</script>

<div class="ed-card">
	<div class="ed-h">
		<div class="ed-label">{edition.label}</div>
		{#if edition.year !== undefined}
			<div class="ed-year">{edition.year}</div>
		{/if}
	</div>
	{#if edition.isbn}
		<div class="ed-row">
			<span class="ed-row-label">{m.library_field_isbn()}</span>
			<span class="ed-row-value mono">{edition.isbn}</span>
		</div>
	{/if}
	{#if edition.publisher}
		<div class="ed-row">
			<span class="ed-row-label">{m.library_field_publisher()}</span>
			<span class="ed-row-value">{edition.publisher}</span>
		</div>
	{/if}
</div>

<style>
	.ed-card {
		background: #f4ead8;
		border: 1px solid #b8a986;
		padding: 7px 10px;
		font-size: 10px;
		box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.1);
	}
	.ed-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 3px;
	}
	.ed-label {
		font-weight: 700;
		font-size: 11px;
	}
	.ed-year {
		font-size: 9px;
		color: #6a5230;
		font-family: 'JetBrains Mono', monospace;
	}
	.ed-row {
		display: flex;
		gap: 10px;
		font-size: 10px;
		color: #4a3a1f;
	}
	.ed-row-label {
		color: #998a6a;
	}
	.mono {
		font-family: 'JetBrains Mono', monospace;
	}
</style>
