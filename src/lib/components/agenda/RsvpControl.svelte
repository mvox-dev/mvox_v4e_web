<!-- src/lib/components/agenda/RsvpControl.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { RsvpStatus } from '$lib/rsvp/rsvpData';

	interface Props {
		status?: RsvpStatus | null;
		disabled?: boolean;
		onchange?: (s: RsvpStatus | null) => void;
	}
	const { status = null, disabled = false, onchange }: Props = $props();

	const BUTTONS: { value: RsvpStatus; label: () => string }[] = [
		{ value: 'going', label: m.rsvp_going },
		{ value: 'not_going', label: m.rsvp_not_going },
		{ value: 'maybe', label: m.rsvp_maybe },
		{ value: 'late', label: m.rsvp_late },
	];

	function handleClick(value: RsvpStatus) {
		if (!onchange) return;
		// Tap active → toggle off (null); tap inactive → set
		onchange(status === value ? null : value);
	}
</script>

<div data-testid="rsvp-control" data-disabled={disabled ? 'true' : undefined} class="rsvp-wrap">
	<div class="seg-row">
		{#each BUTTONS as btn (btn.value)}
			<button
				data-testid="rsvp-btn-{btn.value}"
				type="button"
				{disabled}
				aria-pressed={status === btn.value ? 'true' : 'false'}
				class="seg-btn"
				class:active={status === btn.value}
				onclick={() => handleClick(btn.value)}
			>
				{btn.label()}
			</button>
		{/each}
	</div>
	{#if disabled}
		<p class="not-member-hint">{m.rsvp_not_member()}</p>
	{/if}
</div>

<style>
	.rsvp-wrap {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.seg-row {
		display: inline-flex;
		border: 1px solid rgba(0, 0, 0, 0.18);
		border-radius: 3px;
		overflow: hidden;
	}

	.seg-btn {
		font-family: inherit;
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.03em;
		padding: 2px 6px;
		background: #fbf9f3;
		color: #6a5230;
		border: none;
		border-right: 1px solid rgba(0, 0, 0, 0.12);
		cursor: pointer;
		line-height: 1.4;
		white-space: nowrap;
		transition: background 80ms, color 80ms;
	}

	.seg-btn:last-child {
		border-right: none;
	}

	.seg-btn.active {
		background: #2a2620;
		color: #fbf9f3;
	}

	.seg-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.not-member-hint {
		font-size: 9px;
		color: #998a6a;
		font-style: italic;
		margin: 0;
	}
</style>
