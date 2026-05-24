<script lang="ts">
	const {
		checked = false,
		red = false,
		onclick,
	}: { checked?: boolean; red?: boolean; onclick?: () => void } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	data-checked={checked}
	class="inline-block align-middle relative w-[18px] h-[18px] border-[1.5px] border-ink-2 rounded-[3px] bg-paper shrink-0"
	class:checkmark={checked}
	class:checkmark-red={checked && red}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	{onclick}
	onkeydown={onclick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onclick(); } : undefined}
></span>

<style>
	.checkmark::after {
		content: '';
		position: absolute;
		left: 1px;
		top: -3px;
		width: 22px;
		height: 22px;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 13 Q 8 22 12 16 T 22 2' stroke='%232a2620' stroke-width='2.5' fill='none' stroke-linecap='round'/></svg>");
		background-repeat: no-repeat;
	}
	.checkmark-red::after {
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 13 Q 8 22 12 16 T 22 2' stroke='%23b54a3a' stroke-width='2.5' fill='none' stroke-linecap='round'/></svg>");
	}
</style>
