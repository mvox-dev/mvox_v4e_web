<!-- src/lib/components/agenda/RsvpTallyBadge.svelte -->
<script lang="ts">
	import type { RsvpTally } from '$lib/rsvp/rsvpData';

	interface Props {
		tally: RsvpTally;
	}
	const { tally }: Props = $props();
</script>

<span data-testid="rsvp-tally" class="tally-row">
	<span data-testid="tally-going" class="tally-cell going" title="Going">
		✓{tally.going}
	</span>
	<span data-testid="tally-not_going" class="tally-cell not-going" title="Not going">
		✗{tally.not_going}
	</span>
	<span data-testid="tally-maybe" class="tally-cell maybe" title="Maybe">
		?{tally.maybe}
	</span>
	<span data-testid="tally-late" class="tally-cell late" title="Late">
		⏱{tally.late}
	</span>
</span>

<style>
	.tally-row {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}

	.tally-cell {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.going {
		color: #2e7d32;
	}

	.not-going {
		color: #c0392b;
	}

	.maybe {
		color: #6a5230;
	}

	.late {
		color: #5c6bc0;
	}
</style>
