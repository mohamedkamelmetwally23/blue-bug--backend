import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { TaskEntryModel } from "../task-entries/task-entry.model.js";
import { WeekModel } from "../weeks/week.model.js";
import { TaskModel } from "./task.model.js";

export const taskRouter = Router();

taskRouter.get("/weekly", asyncHandler(async (_req, res) => {
  const week = await WeekModel.findOne({ isActive: true }).sort({ start: -1 });
  if (!week) { res.json({ week: null, tasks: [] }); return; }
  const tasks = await TaskModel.find({ weekId: week.weekId }).sort({ startDate: 1, title: 1 });
  const entries = await TaskEntryModel.find({ weekId: week.weekId });
  const entriesByTask = new Map<string, typeof entries>();
  for (const entry of entries) {
    const taskId = entry.taskId.toString();
    entriesByTask.set(taskId, [...(entriesByTask.get(taskId) ?? []), entry]);
  }
  res.json({
    week: { id: week.weekId, label: week.label, start: week.start.toISOString(), end: week.end.toISOString() },
    tasks: tasks.map((task) => ({
      id: task.id, title: task.title, kind: task.kind, priority: task.priority, owner: task.owner,
      dayBucket: task.dayBucket, dayDate: task.dayDate?.toISOString(),
      normalizedType: task.normalizedType, remaining: task.remaining, blockerSummary: task.blockerSummary, signals: task.signals,
      status: task.status, startDate: task.startDate?.toISOString(), endDate: task.endDate?.toISOString(),
      deliverable: task.deliverable, notes: task.notes, target: task.target,
      entries: (entriesByTask.get(task.id) ?? []).map((entry) => ({ id: entry.id, date: entry.date.toISOString(), completed: entry.completed, notes: entry.notes })),
      sheetCompleted: task.source === "google-sheets" ? task.completed : undefined
    }))
  });
}));
