import { model, Schema } from "mongoose";

export interface Issue { recordId: string; weekId: string; title: string; description?: string; category: "account" | "app" | "website" | "supabase" | "other"; severity: "low" | "medium" | "high" | "critical"; status: "open" | "investigating" | "resolved"; owner?: string; createdAt: Date; }
const schema = new Schema<Issue>({
  recordId: { type: String, required: true, unique: true, index: true }, weekId: { type: String, required: true, index: true },
  title: { type: String, required: true }, description: String,
  category: { type: String, enum: ["account", "app", "website", "supabase", "other"], default: "other" },
  severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
  status: { type: String, enum: ["open", "investigating", "resolved"], default: "open" }, owner: String
}, { timestamps: true });
export const IssueModel = model<Issue>("Issue", schema);

