export const SHEET_SYNC_WEEK = {
  id: "2026-09-28-2026-10-03",
  label: "Sep 28 – Oct 3, 2026",
  start: new Date(Date.UTC(2026, 8, 28)),
  end: new Date(Date.UTC(2026, 9, 3, 23, 59, 59, 999))
};

type NumericDateOrder = "day-first" | "month-first";

const makeUtcDate = (year: number, month: number, day: number): Date | undefined => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : undefined;
};

export const sheetDateOrder = <T extends Record<string, unknown>>(rows: T[]): NumericDateOrder => {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const row of rows) {
    for (const value of [row.startDate, row.endDate]) {
      if (typeof value !== "string") continue;
      const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (!match) continue;
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (first > 12 && second <= 12) dayFirst += 1;
      if (second > 12 && first <= 12) monthFirst += 1;
    }
  }
  return dayFirst > monthFirst ? "day-first" : "month-first";
};

export const parseSheetDate = (value: unknown, numericDateOrder: NumericDateOrder = "month-first"): Date | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return makeUtcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  const numericMatch = normalized.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const third = Number(numericMatch[3]);
    if (numericMatch[1]!.length === 4) return makeUtcDate(first, second, third);
    const order = first > 12 ? "day-first" : second > 12 ? "month-first" : numericDateOrder;
    return order === "day-first"
      ? makeUtcDate(third, second, first)
      : makeUtcDate(third, first, second);
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime())
    ? undefined
    : makeUtcDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
};

export const rowsInSheetSyncWeek = <T extends Record<string, unknown>>(
  rows: T[],
  dateOrder: NumericDateOrder = sheetDateOrder(rows)
): T[] => {
  return rows.filter((row) => {
    const start = parseSheetDate(row.startDate, dateOrder);
    const end = parseSheetDate(row.endDate, dateOrder);
    const taskDate = start ?? end;
    return taskDate !== undefined
      && taskDate.getTime() >= SHEET_SYNC_WEEK.start.getTime()
      && taskDate.getTime() <= SHEET_SYNC_WEEK.end.getTime();
  });
};
