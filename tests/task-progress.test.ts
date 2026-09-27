import { describe, expect, it } from "vitest";
import { calculateTaskProgress, extractWorkflowActual, normalizeTaskType, parseAccountOutcomes, resolveDayBucketDate } from "../src/features/tasks/task-progress.js";

describe("canonical task progress", () => {
  it("counts partial checklist progress while status is in progress", () => {
    expect(calculateTaskProgress({ title: "6 invitations", notes: "✅ first\n☑️ second\n✅ third\n☑ fourth", status: "in-progress" })).toMatchObject({ target: 6, completed: 4, remaining: 2, checklistCount: 4, normalizedType: "invitation acceptance" });
  });

  it("counts a completed full checklist", () => {
    expect(calculateTaskProgress({ title: "5 emails", notes: "✅ a\n✅ b\n✅ c\n✅ d\n✅ e", status: "completed" })).toMatchObject({ target: 5, completed: 5, remaining: 0, checklistCount: 5, normalizedType: "email" });
  });

  it("classifies blocker signals and summarizes missing-work reasons", () => {
    const result = calculateTaskProgress({ title: "1 active wm acc", notes: "🔒 Password expired\n🚩 Website unavailable\n📌 Retry tomorrow\n➡️ pending to active", status: "in-progress" });
    expect(result.signals.map((signal) => signal.type)).toEqual(["credential", "operational", "action", "transition"]);
    expect(result.blockerSummary).toContain("Password expired");
  });

  it("falls back safely when there are no checklist items", () => {
    expect(calculateTaskProgress({ title: "3 scripts", notes: "Work pending", status: "in-progress" }).completed).toBe(0);
    expect(calculateTaskProgress({ title: "3 scripts", notes: "Done", status: "completed" }).completed).toBe(3);
  });

  it("maps P-values to dates from the week start", () => {
    const start = new Date("2026-09-21T00:00:00.000Z");
    expect(resolveDayBucketDate("P0", start)?.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(resolveDayBucketDate("P4", start)?.toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });

  it("removes naming variants from the normalized task type", () => {
    expect(normalizeTaskType("5 emails (atomic,proton)")).toBe("email");
    expect(normalizeTaskType("1 active wm acc")).toBe("active wm account");
    expect(normalizeTaskType("active wm acc+warming 5 acc have money")).toBe("active wm account");
    expect(normalizeTaskType("Target active one acc amz")).toBe("target active account");
  });

  it("counts account outcomes from emoji and explicit quantities", () => {
    expect(parseAccountOutcomes("⛔ +12345678901\n🔒 +12345678902\n✅ +12345678903\n✅ Good - 2 acc\n⛔ Account locked temporarily - 24 acc\n🔒 Incorrect Password / Password reset required - 2 acc\n🚩Account not found - 2 acc\n☑️ user@example.com\n➡️ active@example.com")).toEqual({ good: 4, bad: 26, notFound: 2, total: 32 });
  });

  it("uses the explicit checked-account total for action-needed progress", () => {
    expect(calculateTaskProgress({ title: "action needed (script,active)", notes: "✅ one@example.com\n>>> Total: 33 acc checked", status: "in-progress" })).toMatchObject({ target: 33, completed: 33, remaining: 0 });
  });

  it("extracts workflow quantities from notes instead of counting days", () => {
    expect(extractWorkflowActual("invitation acceptance", "16 emails +4 invitetion check", "completed")).toBe(4);
    expect(extractWorkflowActual("invitation acceptance", "A: Seller Central (Accepted) B: Seller Central (Pending)", "completed")).toBe(2);
    expect(extractWorkflowActual("deactivation date check", "Total: 17 acc checked", "completed")).toBe(17);
    expect(extractWorkflowActual("active wm account", "update app now 5 acc active for wm", "completed")).toBe(5);
    expect(extractWorkflowActual("target active account", "✅ one@example.com\n✅ two@example.com", "in-progress")).toBe(2);
  });
});
