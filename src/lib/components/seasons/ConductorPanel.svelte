<!-- src/lib/components/seasons/ConductorPanel.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Conductor } from '$lib/seasons/types';

	/** A picker-eligible org member (person). */
	export interface OrgMember {
		personId: string;
		name: string;
	}

	interface Props {
		/** The season's directly-assigned conductors (from `listConductors`). */
		conductors: Conductor[];
		/** Active org members available in the "Add conductor" picker. */
		members: OrgMember[];
		/** True when the current user is `_owner`-tier — controls assign/remove visibility. */
		canManage: boolean;
		/** Called when the owner assigns a conductor (personId). */
		onassign: (personId: string) => void;
		/** Called when the owner removes a conductor (propertyValueId for DELETE). */
		onremove: (propertyValueId: string) => void;
	}
	let { conductors, members, canManage, onassign, onremove }: Props = $props();

	let pickerValue = $state('');
</script>

<section data-testid="conductor-panel" class="panel">
	<h3 class="panel-heading">{m.seasons_conductors_heading()}</h3>

	{#if conductors.length === 0}
		<p data-testid="conductors-empty" class="empty-text">{m.seasons_conductors_empty()}</p>
	{:else}
		<ul data-testid="conductors-list" class="conductor-list">
			{#each conductors as conductor (conductor.propertyValueId)}
				<li class="conductor-row">
					<span class="conductor-name">{conductor.name}</span>
					{#if canManage}
						<button
							data-testid="conductor-remove"
							type="button"
							class="remove-btn"
							onclick={() => onremove(conductor.propertyValueId)}
						>
							{m.seasons_conductors_remove()}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if canManage}
		<div data-testid="conductor-picker" class="picker-row">
			<select
				data-testid="conductor-picker-select"
				class="picker-select"
				value={pickerValue}
				onchange={(e) => { pickerValue = (e.target as HTMLSelectElement).value; }}
			>
				<option value="">{m.seasons_conductors_add()}</option>
				{#each members as member (member.personId)}
					<option value={member.personId}>{member.name}</option>
				{/each}
			</select>
			<button
				data-testid="conductor-assign"
				type="button"
				class="assign-btn"
				onclick={() => { if (pickerValue) onassign(pickerValue); }}
			>
				{m.seasons_conductors_add()}
			</button>
		</div>
	{/if}
</section>

<style>
	.panel {
		border: 1px solid #b8a986;
		border-radius: 3px;
		padding: 12px 14px;
		background: #fbf9f3;
	}
	.panel-heading {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		color: #6a5230;
		margin: 0 0 8px;
	}
	.empty-text {
		font-size: 11px;
		color: #998a6a;
		font-style: italic;
		margin: 0 0 8px;
	}
	.conductor-list {
		list-style: none;
		padding: 0;
		margin: 0 0 8px;
	}
	.conductor-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 0;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
		font-size: 11px;
	}
	.conductor-name {
		color: #2a2620;
	}
	.remove-btn {
		font-size: 10px;
		color: #c0392b;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
	}
	.picker-row {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}
	.picker-select {
		flex: 1;
		border: 1px solid #b8a986;
		border-radius: 2px;
		padding: 4px 6px;
		font-size: 11px;
		font-family: inherit;
		background: #fbf9f3;
		color: #2a2620;
	}
	.assign-btn {
		padding: 4px 10px;
		border: 1.5px solid #2a2620;
		background: #2a2620;
		color: #fbf9f3;
		border-radius: 3px;
		font-size: 10px;
		font-family: inherit;
		cursor: pointer;
	}
</style>
