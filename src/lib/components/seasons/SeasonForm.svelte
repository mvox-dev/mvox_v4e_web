<!-- src/lib/components/seasons/SeasonForm.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { validateSeason } from '$lib/seasons/validation';

	/** Payload emitted on submit once validation passes. */
	export interface SeasonCreatePayload {
		name: string;
		startDate: string;
		endDate: string;
		description: string;
	}

	interface Props {
		/** Called with the validated payload on successful submit. */
		oncreate: (payload: SeasonCreatePayload) => void;
	}
	let { oncreate }: Props = $props();

	let name = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let description = $state('');

	/** Field-keyed validation error — null when no error. */
	let fieldError = $state<{ field: string; message: string } | null>(null);

	function errorMessage(code: string): string {
		// Each branch is only evaluated when that specific code is returned —
		// so a spec mock only needs to define the error keys its test actually triggers.
		if (code === 'blank') return m.seasons_error_blank();
		if (code === 'end_before_start') return m.seasons_error_end_before_start();
		if (code === 'interval_too_small') return m.seasons_error_interval_too_small();
		if (code === 'duration_too_small') return m.seasons_error_duration_too_small();
		return code;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		const result = validateSeason({ name, startDate, endDate });
		if (!result.ok) {
			fieldError = { field: result.field, message: errorMessage(result.code) };
			return;
		}
		fieldError = null;
		oncreate({ name, startDate, endDate, description });
	}
</script>

<form data-testid="season-form" onsubmit={handleSubmit}>
	<h2 class="form-heading">{m.seasons_form_season_heading()}</h2>

	<label class="field-label" for="season-name">{m.seasons_field_name()}</label>
	<input
		id="season-name"
		data-testid="season-name"
		type="text"
		class="field-input"
		value={name}
		oninput={(e) => { name = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'name'}
		<span data-testid="error-name" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="season-start-date">{m.seasons_field_start_date()}</label>
	<input
		id="season-start-date"
		data-testid="season-start-date"
		type="date"
		class="field-input"
		value={startDate}
		oninput={(e) => { startDate = (e.target as HTMLInputElement).value; }}
	/>

	<label class="field-label" for="season-end-date">{m.seasons_field_end_date()}</label>
	<input
		id="season-end-date"
		data-testid="season-end-date"
		type="date"
		class="field-input"
		value={endDate}
		oninput={(e) => { endDate = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'endDate'}
		<span data-testid="error-end-date" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="season-description">{m.seasons_field_description()}</label>
	<textarea
		id="season-description"
		data-testid="season-description"
		class="field-input"
		value={description}
		oninput={(e) => { description = (e.target as HTMLTextAreaElement).value; }}
	></textarea>

	<button data-testid="season-submit" type="submit" class="submit-btn">
		{m.seasons_form_season_submit()}
	</button>
</form>

<style>
	.form-heading {
		font-family: inherit;
		font-size: 14px;
		font-weight: 700;
		color: #2a2620;
		margin: 0 0 12px;
	}
	.field-label {
		display: block;
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		color: #6a5230;
		margin-top: 10px;
		margin-bottom: 3px;
	}
	.field-input {
		display: block;
		width: 100%;
		border: 1px solid #b8a986;
		border-radius: 2px;
		padding: 5px 8px;
		font-size: 12px;
		font-family: inherit;
		color: #2a2620;
		background: #fbf9f3;
		box-sizing: border-box;
	}
	.field-input:focus {
		outline: none;
		border-color: #6a5230;
	}
	.field-error {
		display: block;
		font-size: 10px;
		color: #c0392b;
		margin-top: 2px;
	}
	.submit-btn {
		margin-top: 14px;
		padding: 6px 14px;
		border: 1.5px solid #2a2620;
		background: #2a2620;
		color: #fbf9f3;
		border-radius: 3px;
		font-size: 11px;
		font-family: inherit;
		cursor: pointer;
	}
</style>
