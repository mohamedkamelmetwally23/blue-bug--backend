import { model, Schema } from "mongoose";
export interface Expense { recordId: string; weekId: string; description: string; category: string; amount: number; currency: string; spentAt: Date; }
const schema = new Schema<Expense>({ recordId: { type: String, required: true, unique: true }, weekId: { type: String, required: true, index: true }, description: { type: String, required: true }, category: { type: String, required: true }, amount: { type: Number, min: 0, required: true }, currency: { type: String, default: "USD" }, spentAt: { type: Date, required: true } }, { timestamps: true });
export const ExpenseModel = model<Expense>("Expense", schema);

