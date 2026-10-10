import type { Actor } from "../auth/index.js";
import { Task, Category, User, Entry } from "../models.js";
import {
  ensure,
  id,
  taskSchema,
  progressSchema,
  type CategoryDefinition,
} from "../domain.js";
import { role } from "../../shared/permissions/index.js";
export async function findTask(
  actor: Actor,
  taskId: string,
  historical = false,
) {
  id.parse(taskId);
  const task = await Task.findOne({
    _id: taskId,

    ...(actor.role === "employee" && !historical
      ? { assignedEmployee: actor.id }
      : {}),
  });
  ensure(task, 404, "Task not found");
  if (
    actor.role === "employee" &&
    historical &&
    String(task.get("assignedEmployee")) !== actor.id
  )
    ensure(
      await Entry.exists({ taskId, employeeId: actor.id }),
      404,
      "Task not found",
    );
  return task;
}

export async function saveTask(actor: Actor, body: unknown, taskId?: string) {
  role(actor, "coordinator");
  const data = taskSchema.parse(body);
  const [category, employee] = await Promise.all([
    Category.findOne({
      _id: data.categoryId,

      ...(taskId ? {} : { active: true }),
    }),
    User.exists({ _id: data.assignedEmployee, active: true, role: "employee" }),
  ]);
  ensure(category, 422, "Choose an active category");
  ensure(employee, 422, "Choose an active employee");
  const existing = taskId ? await findTask(actor, taskId) : undefined;
  const sheet = existing ? existing.get("workFormat") === "sheet" : !data.title;
  const targetBehavior = existing
    ? (existing.get("categorySchema") as CategoryDefinition).targetBehavior
    : category.get("targetBehavior");
  ensure(
    sheet || targetBehavior !== "required" || data.target != null,
    422,
    "A target is required",
  );
  ensure(
    targetBehavior !== "none" || data.target == null,
    422,
    "This category does not use targets",
  );
  const snapshot = { ...category.toObject(), version: category.get("version") };
  if (!taskId)
    return Task.create({
      ...data,
      title: data.title ?? category.get("name"),
      ...(sheet ? { workFormat: "sheet", status: "" } : {}),
      target: data.target ?? undefined,

      assignedBy: actor.id,
      categorySchema: snapshot,
    });
  const task = existing!;
  ensure(
    String(task.get("categoryId")) === data.categoryId,
    422,
    "An existing task keeps its original category and schema",
  );
  // Task schema is immutable: category edits only affect subsequently created tasks.
  const original = task.get("categorySchema") as CategoryDefinition;
  ensure(
    sheet || original.targetBehavior !== "required" || data.target != null,
    422,
    "A target is required",
  );
  ensure(
    original.targetBehavior !== "none" || data.target == null,
    422,
    "This task does not use targets",
  );
  if (sheet && task.get("endDate"))
    ensure(
      task.get("endDate") >= data.workDate,
      422,
      "Start date must not be after End date",
    );
  task.set({
    ...data,
    title: data.title ?? task.get("title"),
    target: data.target ?? undefined,
  });
  return task.save();
}

export async function progress(actor: Actor, taskId: string, body: unknown) {
  role(actor, "employee");
  const task = await findTask(actor, taskId);
  const data = progressSchema.parse(body);
  const sheet = task.get("workFormat") === "sheet";
  const sheetKeys = [
    "day",
    "endDate",
    "accountNames",
    "numDone",
    "resultStatus",
  ];
  ensure(
    sheet || !sheetKeys.some((key) => key in data),
    422,
    "These fields belong to table tasks",
  );
  ensure(
    !sheet || data.aggregateQuantity === undefined,
    422,
    "Use Num Done for this task",
  );
  if (sheet && data.endDate)
    ensure(
      data.endDate >= task.get("workDate"),
      422,
      "End date must not be before Start date",
    );
  const definition = task.get("categorySchema") as CategoryDefinition;
  ensure(
    data.aggregateQuantity === undefined || definition.mode === "aggregate",
    422,
    "Individual entry tasks derive quantities from saved entries",
  );
  task.set(data);
  return task.save();
}
