<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import DeskSurface from './DeskSurface.svelte';
	import PaperCard from './PaperCard.svelte';

	type Props = {
		label: string;
		name: string;
		description: string;
		backHref: string;
	};

	let { label, name, description, backHref }: Props = $props();
</script>

<DeskSurface>
	<div class="min-h-[80vh] flex flex-col items-center gap-6 py-12 px-6">
		<PaperCard rotate={-0.4} width="480px">
			<div class="flex flex-col gap-1 mb-6">
				<div
					data-testid="coming-soon-label"
					class="font-mono text-[11px] uppercase tracking-widest text-ink-3"
				>
					{label}
				</div>
				<h1 class="font-sans text-[28px] font-bold text-ink leading-tight tracking-[-0.01em] mt-2">
					{name}
				</h1>
				<p class="font-sans text-[13px] text-ink-2 leading-relaxed mt-2">
					{description}
				</p>
			</div>

			<div class="border-t border-ink-5 pt-4 flex flex-col gap-3">
				<div class="font-display text-amber text-[20px] -rotate-6">
					{m.page_coming_soon_label()}
				</div>
				<a
					href={backHref}
					class="font-sans text-[12px] text-ink hover:text-ink-2 no-underline font-medium"
				>
					<span aria-hidden="true">‹</span> {m.page_coming_soon_back_to_agenda()}
				</a>
			</div>
		</PaperCard>
	</div>
</DeskSurface>
