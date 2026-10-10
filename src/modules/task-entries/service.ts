import type { Actor } from "../auth/index.js";
import { Entry } from "../models.js";
import {
  entrySchema,
  validateValues,
  ensure,
  id,
  type CategoryDefinition,
} from "../domain.js";
import { role } from "../../shared/permissions/index.js";
import { findTask } from "../tasks/service.js";
export async function saveEntry(
  actor: Actor,
  taskId: string,
  body: unknown,
  entryId?: string,
) {
  role(actor, "employee");
  const task = await findTask(actor, taskId);
  ensure(
    task.get("workFormat") !== "sheet",
    422,
    "Fill in the task table fields instead",
  );
  const data = entrySchema.parse(body);
  const definition = task.get("categorySchema") as CategoryDefinition;
  validateValues(definition, data);
  if (entryId) {
    id.parse(entryId);
    const entry = await Entry.findOne({ _id: entryId, taskId });
    ensure(entry, 404, "Entry not found");
    entry.set(data);
    return entry.save();
  }
  return Entry.create({
    ...data,
    taskId,
    employeeId: actor.id,
    schemaVersion: definition.version,
  });
}

export async function removeEntry(
  actor: Actor,
  taskId: string,
  entryId: string,
) {
  role(actor, "employee");
  await findTask(actor, taskId);
  id.parse(entryId);
  ensure(
    (await Entry.deleteOne({ _id: entryId, taskId })).deletedCount,
    404,
    "Entry not found",
  );
}
