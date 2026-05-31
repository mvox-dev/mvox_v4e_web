<!-- src/lib/components/library/LibraryMaster.svelte -->
<script lang="ts">
	import type { EntuWork } from '$lib/types/library-entu';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		works: EntuWork[];
		selectedWorkId: string | null;
		onselect: (workId: string) => void;
	}
	let { works, selectedWorkId, onselect }: Props = $props();
</script>

<div data-testid="library-master" class="master-col hidden sm:block">
	<div class="master-paper">
		<div class="master-hdr">
			<span>{m.library_master_count({ n: works.length })}</span>
			<span>{m.library_master_sort_label()}</span>
		</div>
		{#each works as work (work.id)}
			<button
				type="button"
				class="row"
				class:sel={selectedWorkId === work.id}
				data-work-id={work.id}
				onclick={() => onselect(work.id)}
			>
				<span class="composer">{work.composer}</span>
				<span class="titleit">{work.title}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.master-col {
		position: sticky;
		top: 24px;
	}
	.master-paper {
		border: 1px solid #2a2620;
		border-right: 0;
		box-shadow: 3px 3px 0 0 rgba(0, 0, 0, 0.18);
		background: linear-gradient(
			90deg,
			#fbf9f3 0%,
			#fbf9f3 50%,
			rgba(251, 249, 243, 0.5) 75%,
			rgba(251, 249, 243, 0) 100%
		);
		max-height: calc(100vh - 80px);
		overflow-y: auto;
	}
	.master-hdr {
		padding: 7px 12px;
		font-size: 9px;
		color: #6a5230;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		display: flex;
		justify-content: space-between;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.25);
		position: sticky;
		top: 0;
		background: #fbf9f3;
	}
	.row {
		display: block;
		width: 100%;
		text-align: left;
		padding: 5px 12px;
		border: 0;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.2);
		font-size: 10px;
		cursor: pointer;
		line-height: 1.35;
		background: transparent;
		font-family: inherit;
		color: inherit;
	}
	.composer { font-weight: 600; }
	.titleit { font-style: italic; color: #4a3a1f; margin-left: 4px; }
	.row.sel {
		background: rgba(251, 249, 243, 0.92);
		border-left: 3px solid #c47b1b;
		padding-left: 9px;
	}
</style>
