const MS_PER_DAY = 86_400_000;

/** Calendar date of `at` in `timeZone`, as YYYY-MM-DD. */
export function dayKey(at: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(at);
}

export function previousDay(key: string): string {
    return shiftDay(key, -1);
}

export function shiftDay(key: string, days: number): string {
    const at = new Date(parseDay(key) + days * MS_PER_DAY);
    const month = `${at.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${at.getUTCDate()}`.padStart(2, "0");
    return `${at.getUTCFullYear()}-${month}-${day}`;
}

export function daysBetween(from: string, to: string): number {
    return Math.round((parseDay(to) - parseDay(from)) / MS_PER_DAY);
}

// Parsed as UTC midnight purely so date arithmetic never crosses a DST boundary; the timezone that
// decides which calendar day a moment belongs to is applied in dayKey.
function parseDay(key: string): number {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
}
