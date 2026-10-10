import { z } from "zod";
import type { Actor } from "../auth/index.js";
import { ensure, workDate } from "../domain.js";
import { FinancialReport } from "../models.js";
import { role } from "../../shared/permissions/index.js";

export const reportWeek = workDate.refine(
  (date) => new Date(date + "T00:00:00Z").getUTCDay() === 1,
  "Choose the Monday starting the week",
);
const count = z.number().int().min(0).max(1000000000);
const cents = z.number().int().min(0).max(100000000000);
export async function readReport(actor: Actor, week: string) {
  ensure(actor.role !== "employee", 403, "Management access required");
  return FinancialReport.findOne({ weekStart: reportWeek.parse(week) }).lean();
}
export async function saveReport(actor: Actor, week: string, input: unknown) {
  role(actor, "coordinator");
  const weekStart = reportWeek.parse(week);
  const data = z
    .object({
      requiredAccounts: count,
      achievedAccounts: count,
      receivedCents: cents,
      balanceCents: cents,
      reservedCents: cents,
      budgetSummary: z.string().trim().max(5000),
    })
    .strict()
    .parse(input);
  return FinancialReport.findOneAndUpdate(
    { weekStart },
    { $set: { ...data, updatedBy: actor.id } },
    { upsert: true, new: true, runValidators: true },
  ).lean();
}
