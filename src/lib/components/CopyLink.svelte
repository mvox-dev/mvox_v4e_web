<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	const { url = '' }: { url?: string } = $props();

	let copied = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	async function handleCopy() {
		await navigator.clipboard.writeText(url);
		copied = true;
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class="flex items-center gap-2">
	<span class="font-mono text-sm text-ink-3 break-all">{url}</span>
	<button
		data-testid="copy-link-button"
		type="button"
		onclick={handleCopy}
		aria-label={m.invite_copy_link()}
		class="flex-shrink-0 font-sans text-[11px] font-medium px-2 py-1 border border-ink-4 rounded hover:bg-paper-2 text-ink-3"
	>
		{m.invite_copy_link()}
	</button>
	{#if copied}
		<span
			data-testid="copy-link-copied"
			aria-live="polite"
			class="font-sans text-[11px] text-ink-3"
		>{m.invite_copy_link_copied()}</span>
	{/if}
</div>
