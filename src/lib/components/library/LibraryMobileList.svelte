<!-- src/lib/components/library/LibraryMobileList.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EntuWork, EntuEdition } from '$lib/types/library-entu';

	interface Props {
		works: EntuWork[];
		editionsByWork: Map<string, EntuEdition[]>;
	}
	let { works, editionsByWork }: Props = $props();

	let query = $state('');

	let filteredWorks = $derived(
		query.trim() === ''
			? works
			: works.filter((w) => {
					const q = query.toLowerCase();
					return w.title.toLowerCase().includes(q) || w.composer.toLowerCase().includes(q);
				}),
	);
</script>

<div data-testid="library-mobile-list" class="block sm:hidden flex flex-col">
	<div class="sticky top-0 bg-paper px-4 pt-3 pb-2 z-10">
		<input
			data-testid="library-mobile-search"
			type="search"
			placeholder={m.library_mobile_search_placeholder()}
			class="w-full border border-ink-4 rounded px-3 py-2 font-sans text-[13px] bg-paper text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink-2"
			value={query}
			oninput={(e) => {
				query = (e.target as HTMLInputElement).value;
			}}
		/>
	</div>

	{#if filteredWorks.length === 0}
		<div data-testid="library-mobile-empty" class="px-4 py-6 font-sans text-[13px] text-ink-3 text-center">
			{m.library_search_no_results()}
		</div>
	{:else}
		<div class="flex flex-col divide-y divide-ink-5">
			{#each filteredWorks as work (work.id)}
				{@const editionCount = editionsByWork.get(work.id)?.length ?? 0}
				<a
					data-testid="library-mobile-row"
					data-work-id={work.id}
					href="?work={work.id}"
					class="flex items-center gap-3 px-4 py-3 no-underline text-ink hover:bg-paper-2"
				>
					<div class="flex-1 min-w-0">
						<div class="font-sans text-[12px] font-semibold text-ink truncate">{work.composer}</div>
						<div class="font-sans text-[12px] italic text-ink-3 truncate">{work.title}</div>
					</div>
					<div class="flex items-center gap-2 flex-shrink-0">
						{#if editionCount > 0}
							<span class="font-mono text-[10px] text-ink-4">{editionCount}</span>
						{/if}
						<span class="text-ink-4 text-[14px]" aria-hidden="true">›</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
