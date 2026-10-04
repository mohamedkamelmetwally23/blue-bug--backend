export const SHEET_SYNC_WEEK = {
  id: "2026-09-28-2026-10-03",
  label: "Sep 28 – Oct 3, 2026",
  start: new Date(Date.UTC(2026, 8, 28)),
  end: new Date(Date.UTC(2026, 9, 3, 23, 59, 59, 999))
};

export const parseSheetDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date;
};

export const rowsInSheetSyncWeek = <T extends Record<string, unknown>>(rows: T[]): T[] =>
  rows.filter((row) => {
    const start = parseSheetDate(row.startDate);
    const end = parseSheetDate(row.endDate);
    const taskDate = start ?? end;
    return taskDate !== undefined
      && taskDate.getTime() >= SHEET_SYNC_WEEK.start.getTime()
      && taskDate.getTime() <= SHEET_SYNC_WEEK.end.getTime();
  });
