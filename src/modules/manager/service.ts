import type { Actor } from "../auth/index.js";
import { User, Task, Category, Entry } from "../models.js";
import { ensure } from "../domain.js";
import { quantityStages } from "../tasks/queries.js";
export async function employees(actor: Actor) {
  ensure(actor.role !== "employee", 403, "Management access required");
  const [users, stats, contributions] = await Promise.all([
    User.find({ role: "employee" }).select("name email active").lean(),
    Task.aggregate([
      ...quantityStages,
      {
        $lookup: {
          from: "task_entries",
          let: { task: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$taskId", "$$task"] } } },
            { $group: { _id: null, last: { $max: "$updatedAt" } } },
          ],
          as: "entryActivity",
        },
      },
      {
        $group: {
          _id: "$assignedEmployee",
          assigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          quantity: {
            $sum: {
              $cond: [
                { $eq: ["$workFormat", "sheet"] },
                { $ifNull: ["$numDone", 0] },
                {
                  $cond: [
                    { $eq: ["$categorySchema.mode", "aggregate"] },
                    "$aggregateQuantity",
                    0,
                  ],
                },
              ],
            },
          },
          lastActivity: {
            $max: { $max: ["$updatedAt", { $first: "$entryActivity.last" }] },
          },
          statuses: { $push: "$status" },
        },
      },
    ]),
    Entry.aggregate([
      {
        $group: {
          _id: "$employeeId",
          quantity: { $sum: 1 },
          lastActivity: { $max: "$updatedAt" },
        },
      },
    ]),
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));
  for (const contribution of contributions) {
    const key = String(contribution._id);
    const stat = byUser.get(key) ?? {
      assigned: 0,
      completed: 0,
      quantity: 0,
      lastActivity: null,
      statuses: [],
    };
    stat.quantity += contribution.quantity;
    if (!stat.lastActivity || contribution.lastActivity > stat.lastActivity)
      stat.lastActivity = contribution.lastActivity;
    byUser.set(key, stat);
  }
  return users.map((u) => ({
    ...u,
    ...(byUser.get(String(u._id)) ?? {
      assigned: 0,
      completed: 0,
      quantity: 0,
      lastActivity: null,
      statuses: [],
    }),
    _id: u._id,
  }));
}

export async function overview(
  actor: Actor,
  range: { from?: string | undefined; to?: string | undefined } = {},
) {
  ensure(actor.role !== "employee", 403, "Management access required");
  const match =
    range.from || range.to
      ? [
          {
            $match: {
              workDate: {
                ...(range.from ? { $gte: range.from } : {}),
                ...(range.to ? { $lte: range.to } : {}),
              },
            },
          },
        ]
      : [];
  const [categories, stats, trend] = await Promise.all([
    Category.find({}).sort({ name: 1 }).lean(),
    Task.aggregate([
      ...match,
      ...quantityStages,
      {
        $group: {
          _id: "$categoryId",
          tasks: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          quantity: { $sum: "$actualQuantity" },
          target: { $sum: { $ifNull: ["$target", 0] } },
          targetedQuantity: {
            $sum: {
              $cond: [
                { $ne: [{ $ifNull: ["$target", null] }, null] },
                "$actualQuantity",
                0,
              ],
            },
          },
          statuses: { $push: "$status" },
        },
      },
    ]),
    Task.aggregate([
      ...match,
      ...quantityStages,
      { $group: { _id: "$workDate", quantity: { $sum: "$actualQuantity" } } },
      { $sort: { _id: -1 } },
      { $limit: 30 },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const byCategory = new Map(stats.map((s) => [String(s._id), s]));
  return {
    categories: categories.map((c) => ({
      ...c,
      ...(byCategory.get(String(c._id)) ?? {
        tasks: 0,
        completed: 0,
        quantity: 0,
        target: 0,
        targetedQuantity: 0,
        statuses: [],
      }),
      _id: c._id,
    })),
    trend,
  };
}
