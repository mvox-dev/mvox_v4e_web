<!-- src/lib/components/library/LibraryWorkPaperStack.svelte -->
<script lang="ts">
	import type { EntuWork, EntuEdition } from '$lib/types/library-entu';
	import LibraryEditionCard from './LibraryEditionCard.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		work: EntuWork;
		editions: EntuEdition[];
		active: boolean;
	}
	let { work, editions, active }: Props = $props();
</script>

<div class="work-stack" class:active data-work-id={work.id} id={`work-${work.id}`}>
	<div class="work-h">
		<div class="work-title">{work.composer} — <em>{work.title}</em></div>
		<div class="work-tag">
			{active ? m.library_work_eyebrow_in_view() : m.library_work_eyebrow_inactive()}
		</div>
	</div>
	<div class="work-meta">
		{#if work.voicing}
			<span>{m.library_field_voicing()}</span><span class="mono">{work.voicing}</span>
		{/if}
		{#if work.language}
			<span>{m.library_field_language()}</span><span>{work.language}</span>
		{/if}
		{#if work.year !== undefined}
			<span>{m.library_field_year()}</span><span class="mono">{work.year}</span>
		{/if}
	</div>
	<div class="ed-heading">{m.library_work_eyebrow_editions({ n: editions.length })}</div>
	<div class="ed-list">
		{#each editions as edition (edition.id)}
			<LibraryEditionCard {edition} />
		{/each}
	</div>
</div>

<style>
	.work-stack {
		position: relative;
		background: #fbf9f3;
		border: 1px solid #2a2620;
		padding: 12px 16px 14px;
		box-shadow:
			3px 3px 0 0 #d8c7a4, 3px 3px 0 1px #2a2620,
			6px 6px 0 0 #b8a986, 6px 6px 0 1px #2a2620,
			8px 8px 0 0 rgba(0, 0, 0, 0.2);
	}
	.work-stack.active {
		box-shadow:
			3px 3px 0 0 #f0c997, 3px 3px 0 1px #c47b1b,
			6px 6px 0 0 #d8a266, 6px 6px 0 1px #c47b1b,
			8px 8px 0 0 rgba(0, 0, 0, 0.2);
	}
	.work-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
		border-bottom: 1px dashed #c4b58e;
		padding-bottom: 6px;
	}
	.work-title { font-size: 14px; font-weight: 700; }
	.work-tag {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6a5230;
		font-weight: 600;
	}
	.work-meta {
		display: grid;
		grid-template-columns: 85px 1fr;
		row-gap: 3px;
		font-size: 11px;
		margin-bottom: 10px;
	}
	.work-meta span:first-child { color: #998a6a; }
	.ed-heading {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6a5230;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.ed-list { display: flex; flex-direction: column; gap: 8px; }
	.mono { font-family: 'JetBrains Mono', monospace; }
</style>
