import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler.js";
import { validateBody } from "../../core/validation/validate.js";
import { WeekModel } from "./week.model.js";

const weekInput = z.object({
  weekId: z.string().min(1), start: z.coerce.date(), end: z.coerce.date(), label: z.string().min(1),
  targets: z.object({ scripts: z.number().nonnegative(), emails: z.number().nonnegative(), accounts: z.number().nonnegative() }),
  budget: z.number().nonnegative(), currency: z.string().length(3).default("USD")
});
export const weekRouter = Router();
weekRouter.get("/", asyncHandler(async (_req, res) => { res.json(await WeekModel.find().sort({ start: -1 })); }));
weekRouter.put("/:weekId", validateBody(weekInput), asyncHandler(async (req, res) => {
  const week = await WeekModel.findOneAndUpdate({ weekId: req.params.weekId }, req.body, { upsert: true, new: true, runValidators: true });
  res.json(week);
}));
