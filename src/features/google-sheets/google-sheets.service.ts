import { createHash } from "node:crypto";
import { google } from "googleapis";
import { env } from "../../config/env.js";
import { AccountModel } from "../accounts/account.model.js";
import { ExpenseModel } from "../expenses/expense.model.js";
import { IssueModel } from "../issues/issue.model.js";
import { TaskEntryModel } from "../task-entries/task-entry.model.js";
import { TaskModel, type TaskKind, type TaskStatus } from "../tasks/task.model.js";
import { calculateTaskProgress, parseAccountOutcomes, resolveDayBucketDate } from "../tasks/task-progress.js";
import { WeekModel } from "../weeks/week.model.js";
import { normalizeRow, rowsFromValues } from "./google-sheets.mapper.js";
import { sheetRecordSchema } from "./google-sheets.schemas.js";
import { parseSheetDate, rowsInSheetSyncWeek, sheetDateOrder, SHEET_SYNC_WEEK } from "./week-scope.js";

const dateOrUndefined = (value?: string): Date | undefined => value ? new Date(value) : undefined;

const quoteSheetTitle = (title: string): string => `'${title.replaceAll("'", "''")}'`;

interface ConfiguredWorksheet { title: string; gid: number; values: unknown[][]; }

export const readConfiguredWorksheet = async (): Promise<ConfiguredWorksheet> => {
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    fields: "sheets.properties(sheetId,title)"
  });
  const availableSheets = (metadata.data.sheets ?? []).flatMap((sheet) => {
    const { sheetId, title } = sheet.properties ?? {};
    return typeof sheetId !== "number" || typeof title !== "string" ? [] : [{ gid: sheetId, title }];
  });
  const configuredGid = Number(env.GOOGLE_SHEET_GID);
  const selectedSheet = availableSheets.find((sheet) => sheet.gid === configuredGid);
  if (!selectedSheet) {
    const available = availableSheets.map((sheet) => `"${sheet.title}" (gid=${sheet.gid})`).join(", ") || "none";
    throw new Error(`Google worksheet gid ${env.GOOGLE_SHEET_GID} was not found. Available worksheets: ${available}`);
  }
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${quoteSheetTitle(selectedSheet.title)}!A:Z`
  });
  const raw: unknown = response.data.values ?? [];
  const values = Array.isArray(raw) ? raw.filter(Array.isArray) as unknown[][] : [];
  return { title: selectedSheet.title, gid: selectedSheet.gid, values };
};

export const readConfiguredSheet = async (): Promise<unknown[][]> => (await readConfiguredWorksheet()).values;

export const upsertSheetRecord = async (input: Record<string, unknown>): Promise<{ recordId: string; entityType: string }> => {
  const row = sheetRecordSchema.parse(normalizeRow(input));
  const common = { weekId: row.weekId, source: "google-sheets" as const };
  if (row.entityType === "task") {
    const progress = calculateTaskProgress({ title: row.task, notes: row.notes, structuredTarget: row.target, status: row.status });
    const week = await WeekModel.findOne({ weekId: row.weekId });
    const isDayBucket = /^P\d+$/i.test(row.priority);
    await TaskModel.findOneAndUpdate({ recordId: row.recordId }, {
      $set: { ...common, title: row.task, kind: row.kind, owner: row.owner, status: row.status, startDate: dateOrUndefined(row.startDate), endDate: dateOrUndefined(row.endDate), deliverable: row.deliverable, accountNames: row.accountNames, notes: row.notes, dayBucket: isDayBucket ? row.priority.toUpperCase() : undefined, dayDate: isDayBucket && week ? resolveDayBucketDate(row.priority, week.start) : undefined, ...progress },
      ...(isDayBucket ? { $unset: { priority: 1 } } : { $setOnInsert: { priority: row.priority || undefined } })
    }, { upsert: true, runValidators: true });
  } else if (row.entityType === "account") {
    await AccountModel.findOneAndUpdate({ recordId: row.recordId }, { ...common, name: row.name, country: row.country, provider: row.provider, email: row.email, lifecycleStatus: row.lifecycleStatus, invitationStatus: row.invitationStatus, activationStatus: row.activationStatus, deactivationDate: dateOrUndefined(row.deactivationDate), blockers: row.blockers, lastChecked: dateOrUndefined(row.lastChecked) }, { upsert: true, runValidators: true });
  } else if (row.entityType === "issue") {
    await IssueModel.findOneAndUpdate({ recordId: row.recordId }, { weekId: row.weekId, title: row.title, description: row.description, category: row.category, severity: row.severity, status: row.issueStatus, owner: row.owner }, { upsert: true, runValidators: true });
  } else {
    await ExpenseModel.findOneAndUpdate({ recordId: row.recordId }, { weekId: row.weekId, description: row.description, category: row.category, amount: row.amount, currency: row.currency, spentAt: new Date(row.spentAt) }, { upsert: true, runValidators: true });
  }
  return { recordId: row.recordId, entityType: row.entityType };
};

export const pullSheet = async (): Promise<{ synced: number; failures: { row: number; message: string }[] }> => {
  const worksheet = await readConfiguredWorksheet();
  const values = worksheet.values;
  const rows = rowsFromValues(values);
  const normalizedRows = rows.map((row, index) => ({ data: normalizeRow(row), sheetRow: index + 2 }))
    .filter(({ data }) => String(data.task ?? "").trim().toLowerCase() !== "task" && String(data.task ?? "").trim() !== "");
  const dateOrder = sheetDateOrder(normalizedRows.map(({ data }) => data));
  const scopedRows = normalizedRows.filter(({ data }) => rowsInSheetSyncWeek([data], dateOrder).length > 0);
  const start = SHEET_SYNC_WEEK.start;
  const end = SHEET_SYNC_WEEK.end;
  const weekId = `google-${env.GOOGLE_SHEET_ID}-${worksheet.gid}-${SHEET_SYNC_WEEK.id}`;
  const preparedTasks = scopedRows.map(({ data }) => prepareWeeklyTask(data, weekId, worksheet.gid, start, dateOrder));
  const targets = preparedTasks.reduce((result, task) => {
    if (task.kind === "script") result.scripts += task.target;
    if (task.normalizedType === "email") result.emails += task.target;
    if (["activation", "deactivation", "invitation", "action-check"].includes(task.kind)) result.accounts += task.target;
    return result;
  }, { scripts: 0, emails: 0, accounts: 0 });

  await WeekModel.updateMany({ weekId: { $ne: weekId }, isActive: true }, { $set: { isActive: false } });
  await WeekModel.findOneAndUpdate(
    { weekId },
    { $set: { label: SHEET_SYNC_WEEK.label, start, end, targets, isActive: true }, $setOnInsert: { budget: 0, currency: "USD" } },
    { upsert: true, runValidators: true }
  );

  const failures: { row: number; message: string }[] = [];
  let synced = 0;
  const syncedRecordIds: string[] = [];
  for (const [index, task] of preparedTasks.entries()) {
    try {
      const document = await TaskModel.findOneAndUpdate(
        { recordId: task.recordId },
        { $set: { ...task, completed: task.completed, source: "google-sheets" }, $unset: { priority: 1 } },
        { upsert: true, new: true, runValidators: true }
      );
      await TaskEntryModel.findOneAndUpdate(
        { taskId: document._id, date: task.startDate ?? start },
        { weekId, completed: task.completed, notes: task.notes },
        { upsert: true, runValidators: true }
      );
      syncedRecordIds.push(task.recordId);
      synced += 1;
    }
    catch (error: unknown) { failures.push({ row: scopedRows[index]!.sheetRow, message: error instanceof Error ? error.message : "Unknown validation error" }); }
  }
  if (failures.length === 0) {
    const staleTasks = await TaskModel.find({ weekId, source: "google-sheets", recordId: { $nin: syncedRecordIds } }).select("_id");
    if (staleTasks.length > 0) {
      await TaskEntryModel.deleteMany({ taskId: { $in: staleTasks.map((task) => task._id) } });
      await TaskModel.deleteMany({ _id: { $in: staleTasks.map((task) => task._id) } });
    }
  }
  return { synced, failures };
};

const prepareWeeklyTask = (row: Record<string, unknown>, weekId: string, gid: number, weekStart: Date, dateOrder: "day-first" | "month-first") => {
  const title = String(row.task).trim();
  const owner = String(row.owner ?? "").trim() || undefined;
  const startDate = parseSheetDate(row.startDate, dateOrder);
  const endDate = parseSheetDate(row.endDate, dateOrder);
  const deliverable = String(row.deliverable ?? "").trim() || undefined;
  const notes = String(row.notes ?? "").trim() || undefined;
  const dayBucketValue = String(row.priority ?? "").trim().toUpperCase();
  const identity = [env.GOOGLE_SHEET_ID, gid, dayBucketValue, title, owner ?? "", startDate?.toISOString() ?? "", endDate?.toISOString() ?? "", deliverable ?? "", notes ?? ""].join("|");
  const recordId = `sheet-${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
  const normalizedTitle = title.toLowerCase();
  const kind: TaskKind = normalizedTitle.includes("action needed") ? "action-check"
    : normalizedTitle.includes("script") ? "script"
    : normalizedTitle.includes("email") ? "email"
    : normalizedTitle.includes("invitation") ? "invitation"
    : normalizedTitle.includes("deactiv") ? "deactivation"
    : normalizedTitle.includes("activ") || normalizedTitle.includes("wm acc") ? "activation"
    : normalizedTitle.includes("check") ? "action-check" : "other";
  const statusValue = String(row.status ?? "").trim().toLowerCase().replaceAll(" ", "-");
  const status: TaskStatus = statusValue === "completed" ? "completed" : statusValue === "in-progress" ? "in-progress" : statusValue === "blocked" ? "blocked" : "not-started";
  const dayBucket = dayBucketValue || undefined;
  const dayDate = dayBucket ? resolveDayBucketDate(dayBucket, weekStart) : undefined;
  const reportedTarget = String(row.target ?? "").trim();
  const structuredTarget = reportedTarget ? Number(reportedTarget) : undefined;
  if (structuredTarget !== undefined && (!Number.isFinite(structuredTarget) || structuredTarget < 0)) {
    throw new Error(`Invalid Num value for task "${title}"`);
  }
  const progress = calculateTaskProgress({ title, notes, structuredTarget, status });
  const accountNames = String(row.accountNames ?? "").trim();
  const reportedCompleted = String(row.completed ?? "").trim();
  const completed = reportedCompleted ? Number(reportedCompleted) : progress.completed;
  if (!Number.isFinite(completed) || completed < 0) throw new Error(`Invalid completed count for task "${title}"`);
  const target = progress.target;
  return {
    recordId, weekId, title, kind, owner, status, startDate, endDate, deliverable, accountNames, notes, dayBucket, dayDate,
    ...progress, target, completed,
    accountOutcomes: parseAccountOutcomes([accountNames, notes].filter(Boolean).join("\n")),
    workflowActual: reportedCompleted ? completed : progress.workflowActual
  };
};
