import { z } from "zod";
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new DomainError(status, message);
}
export const id = z.string().regex(/^[a-f0-9]{24}$/i);
export const workDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
export const fieldSchema = z
  .object({
    key: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
      .refine((k) => !["__proto__", "constructor", "prototype"].includes(k)),
    label: z.string().trim().min(1).max(100),
    type: z.enum(["text", "longtext", "number", "date", "dropdown", "boolean"]),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  })
  .refine(
    (f) => f.type !== "dropdown" || f.options.length > 0,
    "Dropdown needs options",
  );
export const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000).default(""),
    mode: z.enum(["entries", "aggregate"]).default("entries"),
    targetBehavior: z
      .enum(["optional", "required", "none"])
      .default("optional"),
    results: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    fields: z.array(fieldSchema).max(30).default([]),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(
    (c) => new Set(c.fields.map((f) => f.key)).size === c.fields.length,
    "Field keys must be unique",
  )
  .refine(
    (c) => new Set(c.results).size === c.results.length,
    "Results must be unique",
  );
export type CategoryDefinition = z.infer<typeof categorySchema> & {
  version: number;
};
export const taskSchema = z
  .object({
    categoryId: id,
    assignedEmployee: id,
    title: z.string().trim().min(1).max(200).optional(),
    instructions: z.string().max(5000).default(""),
    workDate,
    target: z.number().int().min(0).max(1000000000).nullable().optional(),
  })
  .strict();
export const progressSchema = z
  .object({
    status: z.enum(["", "Not Started", "In Progress", "Completed"]).optional(),
    notes: z.string().max(5000).optional(),
    aggregateQuantity: z.number().int().min(0).max(1000000000).optional(),
    day: z.string().trim().max(100).optional(),
    endDate: workDate.nullable().optional(),
    accountNames: z.string().max(10000).optional(),
    numDone: z.number().int().min(0).max(1000000000).nullable().optional(),
    resultStatus: z.string().trim().max(200).optional(),
  })
  .strict();
export const entrySchema = z
  .object({
    identifier: z.string().trim().min(1).max(300),
    result: z.string().max(100).default(""),
    values: z.record(z.unknown()).default({}),
    notes: z.string().max(5000).default(""),
  })
  .strict();
export function validateValues(
  category: CategoryDefinition,
  input: z.infer<typeof entrySchema>,
) {
  ensure(
    category.mode === "entries",
    422,
    "Aggregate tasks use quantity, not individual entries",
  );
  ensure(
    category.results.length
      ? category.results.includes(input.result)
      : input.result === "",
    422,
    "Choose a configured result",
  );
  const known = new Set(category.fields.map((f) => f.key));
  ensure(
    Object.keys(input.values).every((k) => known.has(k)),
    422,
    "Unknown work field",
  );
  for (const field of category.fields) {
    const value = input.values[field.key];
    const missing = value === undefined || value === null || value === "";
    ensure(!field.required || !missing, 422, `${field.label} is required`);
    if (missing) continue;
    let valid = false;
    if (["text", "longtext"].includes(field.type))
      valid =
        typeof value === "string" &&
        value.length <= (field.type === "text" ? 500 : 5000);
    if (field.type === "number")
      valid = typeof value === "number" && Number.isFinite(value);
    if (field.type === "boolean") valid = typeof value === "boolean";
    if (field.type === "date") valid = workDate.safeParse(value).success;
    if (field.type === "dropdown")
      valid = typeof value === "string" && field.options.includes(value);
    ensure(valid, 422, `Invalid ${field.label}`);
  }
}
