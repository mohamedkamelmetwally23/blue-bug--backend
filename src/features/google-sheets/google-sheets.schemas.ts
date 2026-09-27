import { z } from "zod";

const text = z.string().trim();
const optionalText = text.optional().transform((value) => value || undefined);
const base = z.object({ recordId: text.min(1), weekId: text.min(1), entityType: z.enum(["task", "account", "issue", "expense"]) });

export const sheetRecordSchema = z.discriminatedUnion("entityType", [
  base.extend({
    entityType: z.literal("task"), task: text.min(1), priority: text.default(""),
    owner: optionalText, status: z.enum(["not-started", "in-progress", "completed", "blocked"]).default("not-started"),
    startDate: optionalText, endDate: optionalText, deliverable: optionalText, notes: optionalText,
    kind: z.enum(["script", "email", "action-check", "invitation", "activation", "deactivation", "other"]).default("other"),
    target: z.coerce.number().nonnegative().default(1)
  }),
  base.extend({
    entityType: z.literal("account"), name: text.min(1), country: optionalText, provider: optionalText, email: optionalText,
    lifecycleStatus: z.enum(["pending", "active", "suspended", "deactivated"]).default("pending"),
    invitationStatus: z.enum(["not-sent", "sent", "accepted", "expired"]).default("not-sent"),
    activationStatus: z.enum(["pending", "active", "failed"]).default("pending"),
    deactivationDate: optionalText, blockers: optionalText, lastChecked: optionalText
  }),
  base.extend({
    entityType: z.literal("issue"), title: text.min(1), description: optionalText,
    category: z.enum(["account", "app", "website", "supabase", "other"]).default("other"),
    severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    issueStatus: z.enum(["open", "investigating", "resolved"]).default("open"), owner: optionalText
  }),
  base.extend({
    entityType: z.literal("expense"), description: text.min(1), category: text.min(1),
    amount: z.coerce.number().nonnegative(), currency: text.length(3).default("USD"), spentAt: text.min(1)
  })
]);

export const webhookSchema = z.object({ row: z.record(z.unknown()) });
export type SheetRecord = z.infer<typeof sheetRecordSchema>;

