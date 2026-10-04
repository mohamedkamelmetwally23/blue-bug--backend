import { describe, expect, it } from "vitest";
import { normalizeRow, rowsFromValues } from "../src/features/google-sheets/google-sheets.mapper.js";
import { sheetRecordSchema } from "../src/features/google-sheets/google-sheets.schemas.js";

describe("Google Sheets row mapping", () => {
  it("maps human-friendly headers and preserves stable recordId", () => {
    const row = normalizeRow({ "Record ID": "task-123", "Week ID": "2026-W40", "Entity Type": "task", Task: "Send partner emails", Status: "in-progress" });
    expect(row.recordId).toBe("task-123");
    expect(sheetRecordSchema.parse(row)).toMatchObject({ recordId: "task-123", weekId: "2026-W40", entityType: "task", task: "Send partner emails" });
  });

  it("creates objects from a header row", () => {
    expect(rowsFromValues([["recordId", "task"], ["abc", "Write scripts"]])).toEqual([{ recordId: "abc", task: "Write scripts" }]);
  });

  it("finds the task table below a title row and maps weekly-plan headers", () => {
    const [row] = rowsFromValues([
      ["", "", "WEEKLY PLAN"],
      ["Task", "Day", "Start date", "End date", "Names of acc", "Num", "Num Done", "Clarifications"],
      ["action needed", "Tuesday", "9/29/2026", "9/30/2026", "✅ one@example.com\n✅ two@example.com", "5", "2", "2 US acc"]
    ]).map(normalizeRow);
    expect(row).toMatchObject({
      task: "action needed", priority: "Tuesday", startDate: "9/29/2026", endDate: "9/30/2026",
      accountNames: "✅ one@example.com\n✅ two@example.com", target: "5", completed: "2", notes: "2 US acc"
    });
  });
});
