import mongoose, { Schema, type SchemaDefinition } from "mongoose";
const ref = { type: Schema.Types.ObjectId, required: true };
function model(
  name: string,
  definition: SchemaDefinition,
  indexes: [Record<string, 1 | -1>, Record<string, unknown>?][] = [],
) {
  const schema = new Schema(definition, {
    timestamps: true,
    strict: "throw",
    optimisticConcurrency: true,
  });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.model(name, schema, name);
}
export const User = model(
  "users",
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["manager", "coordinator", "employee"],
      required: true,
    },
    active: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0 },
    loginWindow: Number,
    loginAttempts: Number,
  },
  [[{ email: 1 }, { unique: true }]],
);
export const Category = model(
  "categories",
  {
    name: { type: String, required: true },
    description: String,
    mode: { type: String, enum: ["entries", "aggregate"], required: true },
    targetBehavior: {
      type: String,
      enum: ["optional", "required", "none"],
      default: "optional",
    },
    results: [String],
    fields: { type: Schema.Types.Mixed, default: [] },
    version: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  [[{ name: 1 }], [{ active: 1, name: 1 }]],
);
export const Task = model(
  "tasks",
  {
    categoryId: ref,
    assignedEmployee: ref,
    assignedBy: ref,
    title: { type: String, required: true },
    instructions: String,
    workDate: { type: String, required: true },
    target: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["", "Not Started", "In Progress", "Completed"],
      default: "Not Started",
    },
    notes: { type: String, default: "" },
    workFormat: { type: String, enum: ["sheet", "legacy"] },
    day: { type: String, default: "" },
    endDate: String,
    accountNames: { type: String, default: "" },
    numDone: { type: Number, min: 0 },
    resultStatus: { type: String, default: "" },
    aggregateQuantity: { type: Number, min: 0, default: 0 },
    categorySchema: { type: Schema.Types.Mixed, required: true },
  },
  [
    [{ workDate: -1, _id: -1 }],
    [{ assignedEmployee: 1, workDate: -1 }],
    [{ categoryId: 1, status: 1 }],
  ],
);
export const Entry = model(
  "task_entries",
  {
    taskId: ref,
    employeeId: ref,
    identifier: { type: String, required: true },
    result: { type: String, default: "" },
    values: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: "" },
    schemaVersion: { type: Number, required: true },
  },
  [[{ taskId: 1, createdAt: -1 }], [{ employeeId: 1, updatedAt: -1 }]],
);
export const FinancialReport = model(
  "weekly_financial_reports",
  {
    weekStart: { type: String, required: true },
    requiredAccounts: { type: Number, required: true, min: 0 },
    achievedAccounts: { type: Number, required: true, min: 0 },
    receivedCents: { type: Number, required: true, min: 0 },
    balanceCents: { type: Number, required: true, min: 0 },
    reservedCents: { type: Number, required: true, min: 0 },
    budgetSummary: { type: String, default: "" },
    updatedBy: ref,
  },
  [[{ weekStart: -1 }, { unique: true }]],
);
export const allModels = [User, Category, Task, Entry, FinancialReport];
