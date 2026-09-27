import { model, Schema } from "mongoose";

export interface Week {
  weekId: string; start: Date; end: Date; label: string;
  targets: { scripts: number; emails: number; accounts: number };
  budget: number; currency: string; isActive: boolean;
}

const weekSchema = new Schema<Week>({
  weekId: { type: String, required: true, unique: true, index: true },
  start: { type: Date, required: true, index: true }, end: { type: Date, required: true },
  label: { type: String, required: true },
  isActive: { type: Boolean, default: false, index: true },
  targets: { scripts: { type: Number, default: 0 }, emails: { type: Number, default: 0 }, accounts: { type: Number, default: 0 } },
  budget: { type: Number, default: 0 }, currency: { type: String, default: "USD" }
}, { timestamps: true });

export const WeekModel = model<Week>("Week", weekSchema);

