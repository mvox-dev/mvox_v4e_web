<!-- src/lib/components/seasons/SeriesForm.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { validateSeries } from '$lib/seasons/validation';
	import type { Season } from '$lib/seasons/types';

	/** Payload emitted on submit once validation passes. */
	export interface SeriesCreatePayload {
		name: string;
		intervalDays: number;
		startTime: string;
		durationMinutes: number;
		startDate: string;
		endDate: string;
		location: string;
		event_type: 'rehearsal';
	}

	interface Props {
		/** The parent season — used by validation to check series dates fall within it. */
		season: Season;
		/** Called with the validated payload on successful submit. */
		oncreate: (payload: SeriesCreatePayload) => void;
	}
	let { season, oncreate }: Props = $props();

	let name = $state('');
	let intervalDays = $state('');
	let startTime = $state('');
	let durationMinutes = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let location = $state('');

	/** Field-keyed validation error — null when no error. */
	let fieldError = $state<{ field: string; message: string } | null>(null);

	function errorMessage(code: string): string {
		// If-chain so each m.* is only accessed when that specific code fires —
		// prevents Vitest strict-mock eager-access failures on unmocked keys.
		if (code === 'blank') return m.seasons_error_blank();
		if (code === 'end_before_start') return m.seasons_error_end_before_start();
		if (code === 'interval_too_small') return m.seasons_error_interval_too_small();
		if (code === 'duration_too_small') return m.seasons_error_duration_too_small();
		if (code === 'outside_season') return m.seasons_error_outside_season();
		return code;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		// Parse numeric string inputs at submit time — the payload must carry numbers.
		// Using Number() rather than parseInt so '0' and empty string both work predictably.
		const intervalDaysNum = intervalDays === '' ? 0 : Number(intervalDays);
		const durationMinutesNum = durationMinutes === '' ? 0 : Number(durationMinutes);
		const result = validateSeries(
			{ name, intervalDays: intervalDaysNum, startTime, durationMinutes: durationMinutesNum, startDate, endDate },
			season,
		);
		if (!result.ok) {
			fieldError = { field: result.field, message: errorMessage(result.code) };
			return;
		}
		fieldError = null;
		oncreate({ name, intervalDays: intervalDaysNum, startTime, durationMinutes: durationMinutesNum, startDate, endDate, location, event_type: 'rehearsal' });
	}
</script>

<form data-testid="series-form" onsubmit={handleSubmit}>
	<h2 class="form-heading">{m.seasons_form_series_heading()}</h2>

	<label class="field-label" for="series-name">{m.seasons_field_name()}</label>
	<input
		id="series-name"
		data-testid="series-name"
		type="text"
		class="field-input"
		value={name}
		oninput={(e) => { name = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'name'}
		<span data-testid="error-name" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="series-interval-days">{m.seasons_field_interval_days()}</label>
	<input
		id="series-interval-days"
		data-testid="series-interval-days"
		type="number"
		class="field-input"
		value={intervalDays}
		oninput={(e) => { intervalDays = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'intervalDays'}
		<span data-testid="error-interval-days" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="series-start-time">{m.seasons_field_start_time()}</label>
	<input
		id="series-start-time"
		data-testid="series-start-time"
		type="time"
		class="field-input"
		value={startTime}
		oninput={(e) => { startTime = (e.target as HTMLInputElement).value; }}
	/>

	<label class="field-label" for="series-duration-minutes">{m.seasons_field_duration()}</label>
	<input
		id="series-duration-minutes"
		data-testid="series-duration-minutes"
		type="number"
		class="field-input"
		value={durationMinutes}
		oninput={(e) => { durationMinutes = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'durationMinutes'}
		<span data-testid="error-duration-minutes" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="series-start-date">{m.seasons_field_start_date()}</label>
	<input
		id="series-start-date"
		data-testid="series-start-date"
		type="date"
		class="field-input"
		value={startDate}
		oninput={(e) => { startDate = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'startDate'}
		<span data-testid="error-start-date" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="series-end-date">{m.seasons_field_end_date()}</label>
	<input
		id="series-end-date"
		data-testid="series-end-date"
		type="date"
		class="field-input"
		value={endDate}
		oninput={(e) => { endDate = (e.target as HTMLInputElement).value; }}
	/>
	{#if fieldError?.field === 'endDate'}
		<span data-testid="error-end-date" class="field-error">{fieldError.message}</span>
	{/if}

	<label class="field-label" for="series-location">{m.seasons_field_location()}</label>
	<input
		id="series-location"
		data-testid="series-location"
		type="text"
		class="field-input"
		value={location}
		oninput={(e) => { location = (e.target as HTMLInputElement).value; }}
	/>

	<button data-testid="series-submit" type="submit" class="submit-btn">
		{m.seasons_form_series_submit()}
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
