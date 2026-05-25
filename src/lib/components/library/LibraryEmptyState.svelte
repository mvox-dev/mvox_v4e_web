<!-- src/lib/components/library/LibraryEmptyState.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="empty-marginalia">
	{m.library_empty_marginalia()}
</div>

<style>
	.empty-marginalia {
		font-family: 'Caveat', cursive;
		color: #f0c6a0;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
		font-size: 16px;
		padding: 20px 0;
		text-align: left;
	}
</style>
