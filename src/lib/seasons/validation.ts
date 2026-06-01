export interface ValidationOk {
	ok: true;
}

export interface ValidationError {
	ok: false;
	field: string;
	code: string;
}

export type ValidationResult = ValidationOk | ValidationError;

export function validateSeason(input: {
	name: string;
	startDate: string;
	endDate: string;
}): ValidationResult {
	if (!/\S/.test(input.name)) {
		return { ok: false, field: 'name', code: 'blank' };
	}
	// ISO YYYY-MM-DD strings compare lexicographically in date order; same-day is allowed.
	if (input.endDate < input.startDate) {
		return { ok: false, field: 'endDate', code: 'end_before_start' };
	}
	return { ok: true };
}

export function validateSeries(
	series: {
		name: string;
		intervalDays: number;
		startTime: string;
		durationMinutes: number;
		startDate: string;
		endDate: string;
	},
	season: { startDate: string; endDate: string },
): ValidationResult {
	if (!/\S/.test(series.name)) {
		return { ok: false, field: 'name', code: 'blank' };
	}
	if (series.intervalDays < 1) {
		return { ok: false, field: 'intervalDays', code: 'interval_too_small' };
	}
	if (series.durationMinutes < 1) {
		return { ok: false, field: 'durationMinutes', code: 'duration_too_small' };
	}
	if (series.endDate < series.startDate) {
		return { ok: false, field: 'endDate', code: 'end_before_start' };
	}
	// Series window must sit within the season window; boundaries are inclusive.
	if (series.startDate < season.startDate) {
		return { ok: false, field: 'startDate', code: 'outside_season' };
	}
	if (series.endDate > season.endDate) {
		return { ok: false, field: 'endDate', code: 'outside_season' };
	}
	return { ok: true };
}
