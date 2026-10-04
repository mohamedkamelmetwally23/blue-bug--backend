import { model, Schema } from "mongoose";

export interface MonthlyPlanFigure {
  value: number;
  label: string;
  detail: string;
}

export interface MonthlyPlanFigures {
  monthlyNeed: MonthlyPlanFigure;
  progressSep: MonthlyPlanFigure;
  currentGap: MonthlyPlanFigure;
  receivedFromManager: MonthlyPlanFigure;
  currentCashBalance: MonthlyPlanFigure;
  reservedBudget: MonthlyPlanFigure;
}

interface MonthlyPlan { key: string; content: string; figures: MonthlyPlanFigures; }

const monthlyPlanFigureSchema = new Schema<MonthlyPlanFigure>({
  value: { type: Number, min: 0, required: true },
  label: { type: String, trim: true, required: true, maxlength: 120 },
  detail: { type: String, trim: true, default: "", maxlength: 120 }
}, { _id: false });

const monthlyPlanFiguresSchema = new Schema<MonthlyPlanFigures>({
  monthlyNeed: { type: monthlyPlanFigureSchema, default: () => ({ value: 50, label: "Monthly Need", detail: "Amazon Accounts" }) },
  progressSep: { type: monthlyPlanFigureSchema, default: () => ({ value: 33, label: "Progress SEP", detail: "Already Achieved" }) },
  currentGap: { type: monthlyPlanFigureSchema, default: () => ({ value: 17, label: "Current Gap", detail: "Remaining Accounts" }) },
  receivedFromManager: { type: monthlyPlanFigureSchema, default: () => ({ value: 440, label: "Received from Manager", detail: "" }) },
  currentCashBalance: { type: monthlyPlanFigureSchema, default: () => ({ value: 68, label: "Current Cash Balance", detail: "" }) },
  reservedBudget: { type: monthlyPlanFigureSchema, default: () => ({ value: 50, label: "Reserved for 10 US Accounts", detail: "" }) }
}, { _id: false });

const monthlyPlanSchema = new Schema<MonthlyPlan>({
  key: { type: String, required: true, unique: true },
  content: { type: String, maxlength: 10000, default: "" },
  figures: { type: monthlyPlanFiguresSchema, default: () => ({}) }
}, { timestamps: true });

export const MonthlyPlanModel = model<MonthlyPlan>("MonthlyPlan", monthlyPlanSchema);
