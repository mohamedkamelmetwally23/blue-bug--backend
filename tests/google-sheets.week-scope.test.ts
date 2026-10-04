import { describe, expect, it } from "vitest";
import { parseSheetDate, rowsInSheetSyncWeek, SHEET_SYNC_WEEK } from "../src/features/google-sheets/week-scope.js";

describe("Google Sheets sync week scope", () => {
  it("uses the requested Sep 28 to Oct 3, 2026 week", () => {
    expect(SHEET_SYNC_WEEK.start.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(SHEET_SYNC_WEEK.end.toISOString()).toBe("2026-10-03T23:59:59.999Z");
  });

  it("keeps only tasks dated in the selected week and excludes old or future rows", () => {
    expect(rowsInSheetSyncWeek([
      { task: "starts in scope", startDate: "9/28/2026", endDate: "9/29/2026" },
      { task: "no start date", endDate: "10/3/2026" },
      { task: "starts before scope", startDate: "9/27/2026", endDate: "9/28/2026" },
      { task: "old", startDate: "9/20/2026", endDate: "9/27/2026" },
      { task: "new", startDate: "10/4/2026", endDate: "10/5/2026" },
      { task: "missing dates" }
    ]).map(({ task }) => task)).toEqual(["starts in scope", "no start date"]);
  });

  it("rejects impossible calendar dates", () => {
    expect(parseSheetDate("9/31/2026")).toBeUndefined();
  });
});
