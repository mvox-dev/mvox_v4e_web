<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { CHOIR, TODAY, MEMBERS, WORKS, TASKS } from '$lib/fixtures/library-mock';
	import { libStats, workById, byMemberId } from '$lib/library/derive';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import PaperStack from '$lib/components/PaperStack.svelte';
	import StackHeader from '$lib/components/StackHeader.svelte';
	import PencilSearch from '$lib/components/PencilSearch.svelte';
	import WorkTitle from '$lib/components/WorkTitle.svelte';
	import CopyChip from '$lib/components/CopyChip.svelte';
	import BorrowerCard from '$lib/components/BorrowerCard.svelte';
	import PullItemCard from '$lib/components/PullItemCard.svelte';
	import VoiceTally from '$lib/components/VoiceTally.svelte';
	import Margin from '$lib/components/Margin.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { selectedOrgStore, userStore, decodeJwt } from '$lib/auth/userStore';
	import { getToken } from '$lib/auth/storage';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { librarySectionStore, hydrateLibrarySection } from '$lib/library/libraryStore';
	import LibraryMasterDetail from '$lib/components/library/LibraryMasterDetail.svelte';
	import LibraryEmptyState from '$lib/components/library/LibraryEmptyState.svelte';

	const returnsTask = TASKS.find((t) => t.id === 'returns')!;
	const overdueTask = TASKS.find((t) => t.id === 'overdue')!;
	const pullTask = TASKS.find((t) => t.id === 'pull')!;

	const tallisWork = workById(WORKS, returnsTask.work_id!)!;
	const tallisEdition = tallisWork.editions[0];
	const tallisCopies = Array.from({ length: tallisEdition.total }, (_, i) => ({
		n: String(i + 1).padStart(2, '0'),
		checked: i < (returnsTask.confirmed ?? 0),
	}));

	const partWork = workById(WORKS, overdueTask.work_id!)!;
	const partEdition = partWork.editions[0];
	const overdueLoans = partEdition.loans ?? [];

	const stats = libStats(WORKS);
	const marginaliaLines = m.library_overdue_marginalia().split('\n');

	let initialWorkId = $derived(page.url.searchParams.get('work'));

	$effect(() => {
		const org = $selectedOrgStore;
		const user = $userStore;
		if (!org || user.status !== 'ready') return;
		const token = getToken();
		if (!token) return;
		const claims = decodeJwt(token);
		const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
		if (!personId) return;
		hydrateLibrarySection({ orgId: org.id, personId });
	});

	$effect(() => {
		const state = $librarySectionStore;
		if (state.status === 'no-rights') {
			goto('/');
		}
	});
</script>

<DeskSurface>
	<div class="flex flex-col">
		<div
			class="flex items-center justify-between py-3 px-7 bg-paper/80 border-b-[1.5px] border-ink-2"
		>
			<div>
				<div class="font-sans text-[10px] tracking-[0.16em] uppercase text-ink-3 font-semibold">
					{m.library_top_eyebrow()}
				</div>
				<div
					class="font-display text-[30px] font-bold text-ink leading-none tracking-[-0.01em] mt-0.5"
				>
					{m.library_top_heading()}
				</div>
			</div>
			<div class="flex items-center gap-4">
				<div class="text-right">
					<div class="font-sans text-[11px] text-ink-3">
						{TODAY.date} · <span class="text-ink">{TODAY.time}</span>
					</div>
					<div class="font-display text-[15px] text-red mt-0.5">
						{m.library_rehearsal_in({ time: '16:00', countdown: '1h 28m' })}
					</div>
				</div>
				<div class="hidden sm:block w-[280px]">
					<PencilSearch placeholder={m.library_search_placeholder()} />
				</div>
			</div>
		</div>

		<div data-testid="library-task-cards" class="hidden sm:grid px-6 py-6 gap-5" style="grid-template-columns: 1fr 1fr 1.15fr">
			<!-- Returns stack -->
			<PaperStack rotate={-0.8}>
				<StackHeader
					rank={1}
					title={m.library_returns_title()}
					subtitle={m.library_returns_subtitle()}
					tone="green"
					stamp={m.library_returns_stamp()}
				/>
				<div class="pt-2"><WorkTitle work={tallisWork} size="s" /></div>
				<div class="font-mono text-[9px] text-ink-3 mt-0.5">
					{tallisEdition.publisher}
					{tallisEdition.year}
				</div>
				<div
					class="mt-2 px-2 py-1.5 bg-paper-2 border border-dashed border-ink-4 rounded-[3px]"
				>
					<div class="flex justify-between items-baseline mb-1.5">
						<span class="font-sans text-[8px] tracking-[0.14em] uppercase text-ink-3 font-semibold"
							>{m.library_returns_folder_label()}</span
						>
						<span class="font-display text-[11px] text-ink-3">{m.library_returns_counted({ n: String(tallisEdition.total) })}</span>
					</div>
					<div class="grid grid-cols-6 gap-1">
						{#each tallisCopies as c (c.n)}<CopyChip n={c.n} checked={c.checked} />{/each}
					</div>
				</div>
				<div class="flex-1"></div>
				<div
					class="flex justify-between items-center pt-2 border-t border-dashed border-ink-5 mt-2"
				>
					<div>
						<span class="font-display font-bold text-[26px] text-ink leading-none"
							>{returnsTask.confirmed}</span
						>
						<span class="font-display text-[14px] text-ink-3">/{returnsTask.count}</span>
						<div class="font-sans text-[8px] tracking-wider uppercase text-ink-3">{m.library_returns_ticked_label()}</div>
					</div>
					<button type="button" class="py-1 px-2.5 border-[1.5px] border-ink bg-ink text-paper rounded-[3px] text-[11px]"
						>{m.library_returns_confirm({ n: String(returnsTask.pending) })}</button
					>
				</div>
			</PaperStack>

			<!-- Overdue stack -->
			<PaperStack rotate={0.6} tone="red">
				<StackHeader
					rank={2}
					title={m.library_overdue_title()}
					subtitle={m.library_overdue_subtitle()}
					tone="red"
					stamp={m.library_overdue_stamp()}
				/>
				<div class="pt-2"><WorkTitle work={partWork} size="s" /></div>
				<div class="font-mono text-[9px] text-ink-3 mt-0.5">
					{partEdition.publisher}
					{partEdition.year}{partEdition.isbn ? ' · ' + partEdition.isbn : ''}
				</div>
				<div class="mt-2 flex flex-col gap-1.5">
					{#each overdueTask.borrowers ?? [] as bid (bid)}
						{@const member = byMemberId(MEMBERS, bid)}
						{@const memberLoans = overdueLoans.filter((l) => l.member === bid)}
						{#if member}
							<BorrowerCard {member} loans={memberLoans} />
						{/if}
					{/each}
				</div>
				<div class="absolute top-9 right-3.5 text-right">
					<Margin rotate={8}>{marginaliaLines[0]}<br />{marginaliaLines[1]}</Margin>
				</div>
				<div class="flex-1"></div>
				<div
					class="flex justify-between items-center pt-2 border-t border-dashed border-ink-5 mt-2"
				>
					<div>
						<span class="font-display font-bold text-[26px] text-red leading-none"
							>{overdueTask.count}</span
						>
						<div class="font-sans text-[8px] tracking-wider uppercase text-red">{m.library_overdue_copies_out()}</div>
					</div>
					<button
						type="button"
						class="py-1 px-2.5 border-[1.5px] border-red bg-paper text-red rounded-[3px] text-[11px]"
						>{m.library_overdue_nudge_both()}</button
					>
				</div>
			</PaperStack>

			<!-- Pull stack -->
			<PaperStack rotate={-0.3}>
				<StackHeader
					rank={3}
					title={m.library_pull_title()}
					subtitle={m.library_pull_subtitle()}
					tone="indigo"
					stamp={m.library_pull_stamp()}
				/>
				<div class="font-sans text-[10.5px] text-ink-3 mt-2">
					{m.library_pull_request_line({ date: TODAY.date.slice(0, 6) })}
				</div>
				<div class="mt-2 flex flex-col gap-1.5 flex-1">
					{#each pullTask.work_ids ?? [] as wid (wid)}
						{@const w = workById(WORKS, wid)}
						{@const e = w?.editions[0]}
						{@const pulled = pullTask.pulled?.[wid] ?? 0}
						{#if w && e}
							<PullItemCard work={w} edition={e} {pulled} needed={CHOIR.rehearsal_size} />
						{/if}
					{/each}
				</div>
				<div
					class="mt-2 px-2 py-1.5 bg-paper-2 rounded-[3px] border border-dashed border-ink-5 flex justify-between items-center font-sans text-[9px] text-ink-3"
				>
					<span>{m.library_pull_singers_tonight()}</span>
					<VoiceTally counts={{ S1: 8, S2: 8, A: 12, T1: 5, T2: 5, B1: 5, B2: 5 }} />
				</div>
			</PaperStack>
		</div>

		<div class="px-6 pb-8">
			{#if $librarySectionStore.status === 'loading'}
				<div class="library-loading">…loading library…</div>
			{:else if $librarySectionStore.status === 'empty'}
				<LibraryEmptyState />
			{:else if $librarySectionStore.status === 'ready'}
				<LibraryMasterDetail
					library={$librarySectionStore.library}
					works={$librarySectionStore.works}
					editionsByWork={$librarySectionStore.editionsByWork}
					{initialWorkId}
				/>
			{:else if $librarySectionStore.status === 'error'}
				<div class="library-error">Something went wrong loading the library.</div>
			{/if}
		</div>
	</div>
</DeskSurface>
