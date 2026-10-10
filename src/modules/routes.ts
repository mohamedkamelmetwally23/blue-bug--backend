import { Router } from "express";
import { z } from "zod";
import { authenticate, login, type Actor } from "./auth/index.js";
import { User, Category, Task, Entry } from "./models.js";
import { ensure, id, workDate } from "./domain.js";
import * as service from "./services.js";
import { readReport, saveReport } from "./financial/service.js";
export const router = Router();
const actor = (res: { locals: Record<string, unknown> }) =>
  res.locals.actor as Actor;
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
router.post("/auth/login", async (req, res) => {
  const data = z
    .object({
      email: z.string().email().max(200),
      password: z.string().min(1).max(200),
    })
    .strict()
    .parse(req.body);
  res.json({ data: await login(data.email, data.password) });
});
router.use(authenticate);
router.use((req, res, next) => {
  ensure(
    actor(res).role !== "manager" ||
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      req.path === "/auth/logout",
    403,
    "Manager workspace is read-only",
  );
  next();
});
router.get("/auth/me", (_req, res) => res.json({ data: actor(res) }));
router.get("/financial-reports/:week", async (req, res) => {
  res.json({ data: await readReport(actor(res), req.params.week) });
});
router.put("/financial-reports/:week", async (req, res) => {
  res.json({ data: await saveReport(actor(res), req.params.week, req.body) });
});
router.post("/auth/logout", async (_req, res) => {
  await User.updateOne({ _id: actor(res).id }, { $inc: { sessionVersion: 1 } });
  res.json({ data: { ok: true } });
});
router.get("/categories", async (req, res) => {
  res.json({
    data: await Category.find({}).sort({ name: 1 }).lean(),
  });
});
router.post("/categories", async (req, res) =>
  res.status(201).json({
    data: await service.saveCategory(actor(res), req.body),
  }),
);
router.put("/categories/:id", async (req, res) =>
  res.json({
    data: await service.saveCategory(actor(res), req.body, req.params.id),
  }),
);
router.delete("/categories/:id", async (req, res) => {
  await service.deleteCategory(actor(res), req.params.id);
  res.json({ data: { ok: true } });
});
router.get("/employees", async (req, res) =>
  res.json({ data: await service.employees(actor(res)) }),
);
router.post("/employees", async (req, res) =>
  res
    .status(201)
    .json({ data: await service.createEmployee(actor(res), req.body) }),
);
router.get("/overview", async (req, res) =>
  res.json({
    data: await service.overview(
      actor(res),
      z
        .object({ from: workDate.optional(), to: workDate.optional() })
        .parse(req.query),
    ),
  }),
);
router.get("/tasks", async (req, res) => {
  const a = actor(res);
  const q = z
    .object({
      categoryId: id.optional(),
      employeeId: id.optional(),
      day: workDate.optional(),
      weekday: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).optional(),
      from: workDate.optional(),
      to: workDate.optional(),
      status: z.enum(["Not Started", "In Progress", "Completed"]).optional(),
    })
    .parse(req.query);
  const { page, limit } = pagination.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (a.role === "employee") {
    if (req.query.history === "true") {
      const previous = await Entry.find({ employeeId: a.id }).distinct(
        "taskId",
      );
      filter.$or = [
        { assignedEmployee: service.objectId(a.id) },
        { _id: { $in: previous } },
      ];
    } else filter.assignedEmployee = service.objectId(a.id);
  } else if (q.employeeId)
    filter.assignedEmployee = service.objectId(q.employeeId);
  if (q.categoryId) filter.categoryId = service.objectId(q.categoryId);
  if (q.status) filter.status = q.status;
  if (q.day) filter.workDate = q.day;
  else if (q.from || q.to)
    filter.workDate = {
      ...(q.from ? { $gte: q.from } : {}),
      ...(q.to ? { $lte: q.to } : {}),
    };
  if (q.weekday) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    filter.$expr = { $eq: [
      { $dayOfWeek: { $dateFromString: { dateString: "$workDate", format: "%Y-%m-%d", onError: null, onNull: null } } },
      weekdays.indexOf(q.weekday) + 1,
    ] };
  }
  const [items, total] = await Promise.all([
    Task.aggregate([
      { $match: filter },
      { $sort: { workDate: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      ...service.quantityStages,
      {
        $lookup: {
          from: "users",
          localField: "assignedEmployee",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "employee",
        },
      },
      { $set: { employeeName: { $first: "$employee.name" } } },
      { $unset: "employee" },
    ]),
    Task.countDocuments(filter),
  ]);
  res.json({ data: { items, total, page, limit } });
});
router.post("/tasks", async (req, res) =>
  res.status(201).json({
    data: await service.saveTask(actor(res), req.body),
  }),
);
router.put("/tasks/:id", async (req, res) =>
  res.json({
    data: await service.saveTask(actor(res), req.body, req.params.id),
  }),
);
router.patch("/tasks/:id/progress", async (req, res) =>
  res.json({
    data: await service.progress(actor(res), req.params.id, req.body),
  }),
);
router.delete("/tasks/:id", async (req, res) => {
  service.role(actor(res), "coordinator");
  const task = await service.findTask(actor(res), req.params.id);
  // Preserve recorded history. Only untouched tasks can be deleted.
  ensure(
    ["", "Not Started"].includes(task.get("status")) &&
      !task.get("day") &&
      !task.get("endDate") &&
      !task.get("accountNames") &&
      task.get("numDone") == null &&
      !task.get("resultStatus") &&
      !task.get("notes") &&
      task.get("aggregateQuantity") === 0 &&
      !(await Entry.exists({ taskId: task._id })),
    409,
    "Only tasks without recorded work can be deleted",
  );
  await task.deleteOne();
  res.json({ data: { ok: true } });
});
router.get("/tasks/:id/entries", async (req, res) => {
  const task = await service.findTask(actor(res), req.params.id, true);
  const entryFilter = {
    taskId: req.params.id,
    ...(actor(res).role === "employee" &&
    String(task.get("assignedEmployee")) !== actor(res).id
      ? { employeeId: actor(res).id }
      : {}),
  };
  const { page, limit } = pagination.parse(req.query);
  const [items, total] = await Promise.all([
    Entry.find(entryFilter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Entry.countDocuments(entryFilter),
  ]);
  res.json({ data: { items, total, page, limit } });
});
router.post("/tasks/:id/entries", async (req, res) =>
  res.status(201).json({
    data: await service.saveEntry(actor(res), req.params.id, req.body),
  }),
);
router.put("/tasks/:id/entries/:entryId", async (req, res) =>
  res.json({
    data: await service.saveEntry(
      actor(res),
      req.params.id,
      req.body,
      req.params.entryId,
    ),
  }),
);
router.delete("/tasks/:id/entries/:entryId", async (req, res) => {
  await service.removeEntry(actor(res), req.params.id, req.params.entryId);
  res.json({ data: { ok: true } });
});
