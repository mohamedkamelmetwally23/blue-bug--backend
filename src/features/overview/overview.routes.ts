import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler.js";
import { validateBody } from "../../core/validation/validate.js";
import { getOverview } from "./overview.service.js";
import { MonthlyPlanModel, type MonthlyPlanFigures } from "./monthly-plan.model.js";

export const overviewRouter = Router();
const defaultFigures: MonthlyPlanFigures = {
  monthlyNeed: { value: 50, label: "Monthly Need", detail: "Amazon Accounts" },
  progressSep: { value: 33, label: "Progress SEP", detail: "Already Achieved" },
  currentGap: { value: 17, label: "Current Gap", detail: "Remaining Accounts" },
  receivedFromManager: { value: 440, label: "Received from Manager", detail: "" },
  currentCashBalance: { value: 68, label: "Current Cash Balance", detail: "" },
  reservedBudget: { value: 50, label: "Reserved for 10 US Accounts", detail: "" }
};
const monthlyPlanFigureSchema = z.object({
  value: z.number().nonnegative().max(1_000_000_000),
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(120)
});
const monthlyPlanFiguresSchema = z.object({
  monthlyNeed: monthlyPlanFigureSchema,
  progressSep: monthlyPlanFigureSchema,
  currentGap: monthlyPlanFigureSchema,
  receivedFromManager: monthlyPlanFigureSchema,
  currentCashBalance: monthlyPlanFigureSchema,
  reservedBudget: monthlyPlanFigureSchema
});
overviewRouter.get("/", asyncHandler(async (req, res) => {
  const query = z.object({ weekId: z.string().min(1).optional() }).parse(req.query);
  res.json(await getOverview(query.weekId));
}));
overviewRouter.get("/monthly-plan", asyncHandler(async (_req, res) => {
  const plan = await MonthlyPlanModel.findOne({ key: "monthly-overview" }).select("content figures").lean();
  res.json({ content: plan?.content ?? "", figures: { ...defaultFigures, ...plan?.figures } });
}));
overviewRouter.put("/monthly-plan", validateBody(z.object({ content: z.string().trim().min(1).max(10000) })), asyncHandler(async (req, res) => {
  const plan = await MonthlyPlanModel.findOneAndUpdate(
    { key: "monthly-overview" },
    { $set: { content: req.body.content }, $setOnInsert: { key: "monthly-overview" } },
    { upsert: true, new: true, runValidators: true }
  ).select("content");
  res.json({ content: plan.content });
}));
overviewRouter.put("/monthly-plan/figures", validateBody(z.object({ figures: monthlyPlanFiguresSchema })), asyncHandler(async (req, res) => {
  const plan = await MonthlyPlanModel.findOneAndUpdate(
    { key: "monthly-overview" },
    { $set: { figures: req.body.figures }, $setOnInsert: { key: "monthly-overview" } },
    { upsert: true, new: true, runValidators: true }
  ).select("figures");
  res.json({ figures: plan.figures });
}));
