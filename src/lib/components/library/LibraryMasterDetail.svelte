<!-- src/lib/components/library/LibraryMasterDetail.svelte -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';
	import LibraryMaster from './LibraryMaster.svelte';
	import LibraryWorkPaperStack from './LibraryWorkPaperStack.svelte';

	interface Props {
		library: EntuLibrary;
		works: EntuWork[];
		editionsByWork: Map<string, EntuEdition[]>;
		initialWorkId: string | null;
	}
	let { library, works, editionsByWork, initialWorkId }: Props = $props();

	let selectedWorkId = $state<string | null>(
		untrack(() => initialWorkId ?? works[0]?.id ?? null),
	);
	let detailContainer: HTMLDivElement | undefined = $state();
	let observer: IntersectionObserver | undefined = $state();

	function handleSelect(workId: string) {
		selectedWorkId = workId;
		syncUrl(workId);
		const el = document.getElementById(`work-${workId}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function syncUrl(workId: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('work', workId);
		history.replaceState(history.state, '', url.toString());
	}

	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		observer = new IntersectionObserver(
			(entries) => {
				const inView = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				if (inView) {
					const workId = (inView.target as HTMLElement).getAttribute('data-work-id');
					if (workId && workId !== selectedWorkId) {
						selectedWorkId = workId;
						syncUrl(workId);
					}
				}
			},
			{ root: null, threshold: 0.5, rootMargin: '-30% 0px -30% 0px' },
		);
		const stacks = detailContainer?.querySelectorAll('[data-work-id]') ?? [];
		stacks.forEach((el) => observer!.observe(el));
		return () => observer?.disconnect();
	});
</script>

<div class="md-wrap">
	<LibraryMaster
		{works}
		{selectedWorkId}
		onselect={handleSelect}
	/>
	<div class="detail-col" bind:this={detailContainer}>
		{#each works as work (work.id)}
			<LibraryWorkPaperStack
				{work}
				editions={editionsByWork.get(work.id) ?? []}
				active={selectedWorkId === work.id}
			/>
		{/each}
	</div>
</div>

<style>
	.md-wrap {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 24px;
		align-items: flex-start;
	}
	.detail-col {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
</style>
