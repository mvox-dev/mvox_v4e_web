const TZ = 'Europe/Tallinn';

/** Inclusive occurrence dates (YYYY-MM-DD) stepping by intervalDays. */
export function occurrenceDates(
	startDate: string,
	endDate: string,
	intervalDays: number,
): string[] {
	const out: string[] = [];
	const end = Date.parse(endDate + 'T00:00:00Z');
	let cur = Date.parse(startDate + 'T00:00:00Z');
	const stepMs = intervalDays * 86_400_000;
	while (cur <= end) {
		out.push(new Date(cur).toISOString().slice(0, 10));
		cur += stepMs;
	}
	return out;
}

/** Combine a local wall-clock date+time in Europe/Tallinn into a UTC ISO instant (DST-aware). */
export function toStartDatetime(date: string, time: string): string {
	const [h, m] = time.split(':').map(Number);
	// Find the UTC offset Tallinn has on this date by formatting a probe noon-UTC instant.
	const probe = new Date(`${date}T12:00:00Z`);
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: TZ,
		timeZoneName: 'shortOffset',
		hour: '2-digit',
		hour12: false,
	}).formatToParts(probe);
	const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'; // e.g. "GMT+3"
	const offHours = Number(off.replace('GMT', '')) || 0;
	const utcMs = Date.parse(`${date}T00:00:00Z`) + (h - offHours) * 3_600_000 + m * 60_000;
	return new Date(utcMs).toISOString();
}
