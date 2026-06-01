<!-- src/lib/components/seasons/SeasonBar.svelte -->
<!-- Horizontal scrollable season-tag row with inline edit + standalone create. -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Season } from '$lib/seasons/types';

	interface Props {
		/** Seasons to display as selectable tags. */
		seasons: Season[];
		/** The currently-selected season id. */
		selectedId: string;
		/** True when the current user is _owner-tier — controls edit/create visibility. */
		canManage: boolean;
		/** Called when a season tag is tapped. */
		onselect: (id: string) => void;
		/** Called when the ✏️ edit button on the selected tag is clicked. */
		onedit: () => void;
		/** Called when the + create button is clicked. */
		oncreate: () => void;
	}
	let { seasons, selectedId, canManage, onselect, onedit, oncreate }: Props = $props();
</script>

<div data-testid="season-bar" class="bar">
	{#each seasons as season (season.id)}
		<div class="tag-wrap">
			<button
				data-testid="season-tag"
				data-season-id={season.id}
				type="button"
				class="tag"
				class:selected={season.id === selectedId}
				onclick={() => onselect(season.id)}
			>
				{season.name}
			</button>
			{#if season.id === selectedId && canManage}
				<button
					data-testid="season-tag-edit"
					type="button"
					class="edit-btn"
					aria-label={m.seasons_a11y_edit_season()}
					onclick={() => onedit()}
				>
					✏️
				</button>
			{/if}
		</div>
	{/each}

	{#if canManage}
		<button
			data-testid="season-create"
			type="button"
			class="create-btn"
			aria-label={m.seasons_a11y_create_season()}
			onclick={() => oncreate()}
		>
			+
		</button>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow-x: auto;
		padding: 8px 16px;
		/* Prevent sticky overflow clip trap — no overflow on ancestors of absolute descendants */
		scrollbar-width: none;
	}
	.bar::-webkit-scrollbar {
		display: none;
	}
	.tag-wrap {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}
	.tag {
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		padding: 4px 10px;
		border: 1.5px solid #b8a986;
		border-radius: 14px;
		background: #fbf9f3;
		color: #2a2620;
		cursor: pointer;
		white-space: nowrap;
	}
	.tag.selected {
		background: #2a2620;
		color: #fbf9f3;
		border-color: #2a2620;
	}
	.edit-btn {
		font-size: 13px;
		padding: 2px 4px;
		background: none;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		line-height: 1;
	}
	.create-btn {
		font-family: inherit;
		font-size: 16px;
		font-weight: 400;
		line-height: 1;
		padding: 2px 8px;
		border: 1.5px solid #b8a986;
		border-radius: 14px;
		background: #fbf9f3;
		color: #6a5230;
		cursor: pointer;
		flex-shrink: 0;
	}
</style>
