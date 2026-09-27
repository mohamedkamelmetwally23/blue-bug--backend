import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler.js";
import { getOverview } from "./overview.service.js";

export const overviewRouter = Router();
overviewRouter.get("/", asyncHandler(async (req, res) => {
  const query = z.object({ weekId: z.string().min(1).optional() }).parse(req.query);
  res.json(await getOverview(query.weekId));
}));

