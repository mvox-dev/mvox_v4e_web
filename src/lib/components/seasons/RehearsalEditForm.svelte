<!-- src/lib/components/seasons/RehearsalEditForm.svelte -->
<!-- Inline edit form for a single rehearsal. NO modal — {#if} block, mirroring SeasonForm.svelte. -->
<!-- Dirty-tracking: onsave emits ONLY changed fields (prevents session-29 description-wipe). -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Rehearsal } from '$lib/seasons/types';
	import type { RehearsalPatch } from '$lib/seasons/entuSeasons';

	interface Props {
		/** The rehearsal being edited — fields pre-populated from this value. */
		rehearsal: Rehearsal;
		/**
		 * Called on submit with a patch carrying ONLY the changed fields
		 * (dirty-tracking). Unchanged fields are NOT included.
		 */
		onsave: (patch: RehearsalPatch) => void;
		/** Called when cancel is clicked — closes the form without saving. */
		oncancel?: () => void;
	}
	let { rehearsal, onsave, oncancel }: Props = $props();

	/** Convert ISO datetime string to a datetime-local input value (YYYY-MM-DDTHH:MM). */
	function toDatetimeLocal(iso: string): string {
		// datetime-local inputs expect "YYYY-MM-DDTHH:MM" — strip seconds and Z.
		return iso.replace(/:\d{2}(\.\d+)?Z?$/, '');
	}

	// Local field state — pre-filled from the rehearsal prop.
	let startDatetime = $state(toDatetimeLocal(rehearsal.startDatetime));
	let durationMinutes = $state(rehearsal.durationMinutes);
	let location = $state(rehearsal.location ?? '');
	let description = $state(rehearsal.description ?? '');

	// Original values for dirty-tracking (never mutated).
	const orig = {
		start_datetime: toDatetimeLocal(rehearsal.startDatetime),
		duration_minutes: rehearsal.durationMinutes,
		location: rehearsal.location ?? '',
		description: rehearsal.description ?? '',
	};

	function handleSubmit() {
		const patch: RehearsalPatch = {};
		// Only include fields that actually changed.
		if (startDatetime !== orig.start_datetime) patch.start_datetime = startDatetime;
		if (durationMinutes !== orig.duration_minutes) patch.duration_minutes = durationMinutes;
		if (location !== orig.location) patch.location = location;
		if (description !== orig.description) patch.description = description;
		onsave(patch);
	}
</script>

<div data-testid="rehearsal-edit-form" class="edit-form">
	<h2 data-testid="rehearsal-edit-heading" class="form-heading">{m.seasons_form_rehearsal_edit_heading()}</h2>
	<div class="form-row">
		<label class="field-label" for="rehearsal-edit-start-datetime">
			{m.seasons_field_start_date()}
		</label>
		<input
			id="rehearsal-edit-start-datetime"
			data-testid="rehearsal-edit-start-datetime"
			type="datetime-local"
			class="field-input"
			bind:value={startDatetime}
		/>
	</div>

	<div class="form-row">
		<label class="field-label" for="rehearsal-edit-duration">
			{m.seasons_field_duration()}
		</label>
		<input
			id="rehearsal-edit-duration"
			data-testid="rehearsal-edit-duration"
			type="number"
			min="1"
			class="field-input field-input--narrow"
			bind:value={durationMinutes}
		/>
	</div>

	<div class="form-row">
		<label class="field-label" for="rehearsal-edit-location">
			{m.seasons_field_location()}
		</label>
		<input
			id="rehearsal-edit-location"
			data-testid="rehearsal-edit-location"
			type="text"
			class="field-input"
			bind:value={location}
		/>
	</div>

	<div class="form-row">
		<label class="field-label" for="rehearsal-edit-description">
			{m.seasons_field_description()}
		</label>
		<textarea
			id="rehearsal-edit-description"
			data-testid="rehearsal-edit-description"
			class="field-input field-input--textarea"
			bind:value={description}
		></textarea>
	</div>

	<div class="form-actions">
		<button
			data-testid="rehearsal-edit-save"
			type="button"
			class="btn-save"
			onclick={handleSubmit}
		>
			{m.seasons_form_season_save()}
		</button>
		{#if oncancel}
			<button
				data-testid="rehearsal-edit-cancel"
				type="button"
				class="btn-cancel"
				onclick={oncancel}
			>
				{m.actions_cancel()}
			</button>
		{/if}
	</div>
</div>

<style>
	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 0;
	}
	.form-heading {
		font-family: inherit;
		font-size: 14px;
		font-weight: 700;
		color: #2a2620;
		margin: 0 0 12px;
	}
	.form-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.field-label {
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-weight: 600;
		color: #6a5230;
	}
	.field-input {
		font-family: inherit;
		font-size: 12px;
		padding: 5px 8px;
		border: 1.5px solid #b8a986;
		border-radius: 3px;
		background: #fbf9f3;
		color: #2a2620;
		width: 100%;
		box-sizing: border-box;
	}
	.field-input--narrow {
		width: 120px;
	}
	.field-input--textarea {
		resize: vertical;
		min-height: 60px;
	}
	.form-actions {
		display: flex;
		gap: 8px;
		align-items: center;
		padding-top: 4px;
	}
	.btn-save {
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 14px;
		background: #2a2620;
		color: #fbf9f3;
		border: none;
		border-radius: 3px;
		cursor: pointer;
	}
	.btn-cancel {
		font-family: inherit;
		font-size: 12px;
		color: #6a5230;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}
</style>
