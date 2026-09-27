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
});

