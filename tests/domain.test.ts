import { describe, it, expect } from "vitest";
import {
  categorySchema,
  validateValues,
  workDate,
} from "../src/modules/domain.js";
import { hashPassword, verifyPassword } from "../src/modules/auth/index.js";
describe("category validation", () => {
  const category = {
    ...categorySchema.parse({
      name: "Attention",
      results: ["Good", "Pending"],
      fields: [
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "done", label: "Done", type: "boolean", required: true },
        { key: "date", label: "Date", type: "date" },
        {
          key: "channel",
          label: "Channel",
          type: "dropdown",
          options: ["Email"],
        },
      ],
    }),
    version: 1,
  };
  it("accepts zero and false as required values", () =>
    expect(() =>
      validateValues(category, {
        identifier: "A",
        result: "Good",
        values: { amount: 0, done: false },
        notes: "",
      }),
    ).not.toThrow());
  it.each([
    { amount: "1", done: true },
    { amount: 1 },
    { amount: 1, done: false, extra: "x" },
    { amount: 1, done: true, date: "2026-02-30" },
    { amount: 1, done: true, channel: "Other" },
  ])("rejects malformed dynamic values %j", (values) =>
    expect(() =>
      validateValues(category, {
        identifier: "A",
        result: "Good",
        values,
        notes: "",
      }),
    ).toThrow(),
  );
  it("rejects unconfigured results and mixed aggregate entries", () => {
    expect(() =>
      validateValues(category, {
        identifier: "A",
        result: "Unknown",
        values: {},
        notes: "",
      }),
    ).toThrow();
    expect(() =>
      validateValues(
        { ...category, mode: "aggregate" },
        { identifier: "A", result: "Good", values: {}, notes: "" },
      ),
    ).toThrow();
  });
  it("rejects duplicate field keys and invalid dates", () => {
    expect(
      categorySchema.safeParse({
        name: "X",
        fields: [
          { key: "x", label: "X", type: "text" },
          { key: "x", label: "Y", type: "text" },
        ],
      }).success,
    ).toBe(false);
    expect(workDate.safeParse("2026-02-29").success).toBe(false);
  });
  it("preserves existing scrypt password format", () => {
    const hash = hashPassword("test-password");
    expect(verifyPassword("test-password", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});
