<!-- src/lib/components/library/LibraryMasterDetail.svelte -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';
	import * as m from '$lib/paraglide/messages.js';
	import LibraryMaster from './LibraryMaster.svelte';
	import LibraryWorkPaperStack from './LibraryWorkPaperStack.svelte';
	import LibraryMobileList from './LibraryMobileList.svelte';

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

	// Exported predicate — gated by matchMedia so mobile viewport never constructs the
	// IntersectionObserver.
	export function isDesktopViewport(): boolean {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(min-width: 640px)').matches;
	}

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

	// Selected work object for mobile detail view
	let selectedWork = $derived(works.find((w) => w.id === initialWorkId) ?? null);

	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		// Scroll-spy only wired on desktop (>= sm breakpoint) — mobile uses the
		// anchor-row navigation model instead.
		if (!isDesktopViewport()) return;
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

<!-- Mobile: below sm — list mode or detail mode depending on initialWorkId -->
{#if initialWorkId == null}
	<LibraryMobileList {works} {editionsByWork} />
{:else}
	<div data-testid="library-mobile-detail" class="block sm:hidden">
		<a
			data-testid="library-mobile-back"
			href="?"
			class="inline-flex items-center gap-1 font-sans text-[13px] text-ink-3 no-underline py-2 px-4"
		>
			{m.library_back_to_works()}
		</a>
		{#if selectedWork}
			<div class="px-4">
				<LibraryWorkPaperStack
					work={selectedWork}
					editions={editionsByWork.get(selectedWork.id) ?? []}
					active={true}
				/>
			</div>
		{/if}
	</div>
{/if}

<!-- Desktop: sm+ — 2-col master + detail grid -->
<div data-testid="library-md-grid" class="hidden sm:grid md-wrap">
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
