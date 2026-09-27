import { timingSafeEqual } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { asyncHandler } from "../../core/http/async-handler.js";
import { validateBody } from "../../core/validation/validate.js";
import { pullSheet, upsertSheetRecord } from "./google-sheets.service.js";
import { webhookSchema } from "./google-sheets.schemas.js";

const authenticateWebhook: RequestHandler = (req, _res, next) => {
  const supplied = req.header("x-webhook-secret") ?? "";
  const expected = env.GOOGLE_WEBHOOK_SECRET;
  const valid = supplied.length === expected.length && expected.length > 0 && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) { next(new AppError(401, "INVALID_WEBHOOK_SECRET", "Invalid webhook secret")); return; }
  next();
};

export const googleSheetsRouter = Router();
googleSheetsRouter.post("/webhook", authenticateWebhook, validateBody(webhookSchema), asyncHandler(async (req, res) => {
  const result = await upsertSheetRecord(req.body.row as Record<string, unknown>);
  res.status(202).json({ synced: true, ...result });
}));
googleSheetsRouter.post("/sync", authenticateWebhook, asyncHandler(async (_req, res) => { res.json(await pullSheet()); }));

