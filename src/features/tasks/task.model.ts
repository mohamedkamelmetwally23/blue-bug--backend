import { model, Schema } from "mongoose";

export type TaskKind = "script" | "email" | "action-check" | "invitation" | "activation" | "deactivation" | "other";
export type TaskStatus = "not-started" | "in-progress" | "completed" | "blocked";

export interface Task {
  recordId: string; weekId: string; title: string; kind: TaskKind;
  priority?: "low" | "medium" | "high" | "urgent"; owner?: string;
  dayBucket?: string; dayDate?: Date;
  normalizedType: string; remaining: number; blockerSummary?: string;
  workflowActual: number;
  signals: Array<{ type: "blocked" | "credential" | "operational" | "action" | "transition"; text: string }>;
  accountOutcomes: { good: number; bad: number; notFound: number; total: number };
  status: TaskStatus; startDate?: Date; endDate?: Date; completed?: number;
  deliverable?: string; notes?: string; target: number; source: "dashboard" | "google-sheets";
}

const taskSchema = new Schema<Task>({
  recordId: { type: String, required: true, unique: true, index: true },
  weekId: { type: String, required: true, index: true }, title: { type: String, required: true },
  kind: { type: String, enum: ["script", "email", "action-check", "invitation", "activation", "deactivation", "other"], default: "other" },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"] },
  dayBucket: String, dayDate: Date,
  normalizedType: { type: String, required: true, index: true }, remaining: { type: Number, min: 0, default: 0 }, blockerSummary: String,
  workflowActual: { type: Number, min: 0, default: 0 },
  signals: { type: [{ type: { type: String, enum: ["blocked", "credential", "operational", "action", "transition"], required: true }, text: { type: String, required: true } }], default: [] },
  accountOutcomes: { good: { type: Number, default: 0 }, bad: { type: Number, default: 0 }, notFound: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
  owner: String, status: { type: String, enum: ["not-started", "in-progress", "completed", "blocked"], default: "not-started" },
  startDate: Date, endDate: Date, deliverable: String, notes: String,
  target: { type: Number, default: 1 }, completed: { type: Number, min: 0 }, source: { type: String, enum: ["dashboard", "google-sheets"], default: "dashboard" }
}, { timestamps: true });

export const TaskModel = model<Task>("Task", taskSchema);
