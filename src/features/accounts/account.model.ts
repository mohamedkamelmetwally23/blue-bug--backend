import { model, Schema } from "mongoose";

export interface Account {
  recordId: string; weekId: string; name: string; country?: string; provider?: string; email?: string;
  lifecycleStatus: "pending" | "active" | "suspended" | "deactivated";
  invitationStatus: "not-sent" | "sent" | "accepted" | "expired";
  activationStatus: "pending" | "active" | "failed"; deactivationDate?: Date;
  blockers?: string; lastChecked?: Date; source: "dashboard" | "google-sheets";
}
const schema = new Schema<Account>({
  recordId: { type: String, required: true, unique: true, index: true }, weekId: { type: String, required: true, index: true },
  name: { type: String, required: true }, country: String, provider: String, email: String,
  lifecycleStatus: { type: String, enum: ["pending", "active", "suspended", "deactivated"], default: "pending" },
  invitationStatus: { type: String, enum: ["not-sent", "sent", "accepted", "expired"], default: "not-sent" },
  activationStatus: { type: String, enum: ["pending", "active", "failed"], default: "pending" },
  deactivationDate: Date, blockers: String, lastChecked: Date,
  source: { type: String, enum: ["dashboard", "google-sheets"], default: "dashboard" }
}, { timestamps: true });
export const AccountModel = model<Account>("Account", schema);

