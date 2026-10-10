import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User, allModels, Task, Entry } from "../src/modules/models.js";
import { hashPassword } from "../src/modules/auth/index.js";
let mongo: MongoMemoryServer;
const app = createApp();
let categoryId: string, taskId: string, employeeId: string;
const tokens: Record<string, string> = {};
async function call(
  role: string,
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  body?: object,
) {
  const agent = request(app);
  const req = agent[method]("/api/v1" + path).set(
    "Authorization",
    "Bearer " + tokens[role],
  );
  return body ? req.send(body) : req;
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "ops_test_v3";
  process.env.AUTH_SECRET =
    "test-secret-that-is-longer-than-thirty-two-characters";
  await connectDatabase();
  for (const model of allModels) await model.init();
  for (const role of ["manager", "coordinator", "employee"]) {
    const user = await User.create({
      name: role,
      email: role + "@test.local",
      role,
      passwordHash: hashPassword("test-password"),
    });
    if (role === "employee") employeeId = String(user._id);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: role + "@test.local", password: "test-password" });
    expect(login.status).toBe(200);
    tokens[role] = login.body.data.token;
  }
});
afterAll(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
describe("simplified operations flow", () => {
  it("keeps financial reports separate by week with exact cents and management permissions", async () => {
    const path = "/financial-reports/2026-10-05";
    const data = {
      requiredAccounts: 50,
      achievedAccounts: 36,
      receivedCents: 40000,
      balanceCents: 35041,
      reservedCents: 5000,
      budgetSummary: "October budget",
    };
    expect((await call("employee", "get", path)).status).toBe(403);
    for (const role of ["employee", "manager"])
      expect((await call(role, "put", path, data)).status).toBe(403);
    expect((await call("coordinator", "get", path)).body.data).toBeNull();
    expect(
      (await call("coordinator", "put", "/financial-reports/2026-10-06", data))
        .status,
    ).toBe(422);
    expect(
      (await call("coordinator", "put", path, { ...data, receivedCents: 1.5 }))
        .status,
    ).toBe(422);
    expect(
      (
        await call("coordinator", "put", path, {
          ...data,
          requiredAccounts: -1,
        })
      ).status,
    ).toBe(422);
    const saved = await call("coordinator", "put", path, data);
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject(data);
    expect((await call("manager", "get", path)).body.data.balanceCents).toBe(
      35041,
    );
    const other = "/financial-reports/2026-10-12";
    expect((await call("coordinator", "get", other)).body.data).toBeNull();
    await call("coordinator", "put", other, { ...data, balanceCents: 100 });
    await call("coordinator", "put", path, { ...data, achievedAccounts: 40 });
    expect(
      (await call("coordinator", "get", other)).body.data.balanceCents,
    ).toBe(100);
    expect(
      (await call("coordinator", "get", path)).body.data.achievedAccounts,
    ).toBe(40);
  });
  it("creates sign-in ready employee accounts without teams and protects credentials", async () => {
    const body = {
      name: " New employee ",
      email: "NEW@test.local",
      password: "new-password",
    };
    for (const role of ["manager", "employee"])
      expect((await call(role, "post", "/employees", body)).status).toBe(403);
    expect(
      (
        await call("coordinator", "post", "/employees", {
          ...body,
          role: "manager",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call("coordinator", "post", "/employees", {
          ...body,
          password: "short",
        })
      ).status,
    ).toBe(422);
    const result = await call("coordinator", "post", "/employees", body);
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      name: "New employee",
      email: "new@test.local",
      role: "employee",
      active: true,
    });
    expect(result.body.data).not.toHaveProperty("passwordHash");
    expect(result.body.data).not.toHaveProperty("password");
    expect((await call("coordinator", "post", "/employees", body)).status).toBe(
      409,
    );
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "new@test.local", password: body.password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe("employee");
    const list = await call("coordinator", "get", "/employees");
    expect(
      list.body.data.some(
        (employee: { _id: string }) => employee._id === result.body.data._id,
      ),
    ).toBe(true);
  });
  it("authenticates all roles and rejects invalid credentials", async () => {
    for (const role of Object.keys(tokens))
      expect((await call(role, "get", "/auth/me")).body.data.role).toBe(role);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .send({ email: "employee@test.local", password: "wrong" })
      ).status,
    ).toBe(401);
  });
  it("enforces category role permissions", async () => {
    for (const role of ["employee", "manager"])
      expect(
        (await call(role, "post", "/categories", { name: "Denied" })).status,
      ).toBe(403);

    const result = await call("coordinator", "post", "/categories", {
      name: "Attention",
      results: ["Good", "Pending", "Bad"],
      fields: [
        { key: "detail", label: "Detail", type: "longtext", required: true },
      ],
    });
    expect(result.status).toBe(201);
    categoryId = result.body.data._id;
  });

  it("deletes only unused categories with Coordinator role authorization", async () => {
    const created = await call("coordinator", "post", "/categories", {
      name: "Disposable category",
    });
    const path = "/categories/" + created.body.data._id;
    for (const role of ["manager", "employee"])
      expect((await call(role, "delete", path)).status).toBe(403);

    expect((await call("coordinator", "delete", path)).status).toBe(200);
    expect((await call("coordinator", "delete", path)).status).toBe(404);
  });
  it("creates and assigns task, visible to employee", async () => {
    const result = await call("coordinator", "post", "/tasks", {
      categoryId,
      assignedEmployee: employeeId,
      title: "Review",
      instructions: "Check account",
      workDate: "2026-10-10",
      target: 1,
    });
    expect(result.status).toBe(201);
    taskId = result.body.data._id;
    const list = await call("employee", "get", "/tasks");
    expect(list.body.data.items[0].actualQuantity).toBe(0);
    expect(list.body.data.total).toBe(1);
  });
  it("protects categories referenced by tasks", async () => {
    expect(
      (await call("coordinator", "delete", "/categories/" + categoryId)).status,
    ).toBe(409);
  });
  it("freezes category fields for existing tasks", async () => {
    expect(
      (
        await call("coordinator", "put", "/categories/" + categoryId, {
          name: "Attention",
          results: ["New"],
          fields: [{ key: "new", label: "New", type: "text", required: true }],
        })
      ).status,
    ).toBe(200);
    const task = await Task.findById(taskId);
    expect(task!.get("categorySchema").version).toBe(1);
  });
  it("records work, edits, deletes, and derives counts without auto-completion", async () => {
    expect(
      (
        await call("employee", "patch", "/tasks/" + taskId + "/progress", {
          status: "In Progress",
          notes: "Working",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("employee", "post", "/tasks/" + taskId + "/entries", {
          identifier: "A",
          result: "Good",
        })
      ).status,
    ).toBe(422);
    const entry = await call(
      "employee",
      "post",
      "/tasks/" + taskId + "/entries",
      {
        identifier: "A",
        result: "Bad",
        values: { detail: "Checked" },
        notes: "Follow up",
      },
    );
    expect(entry.status).toBe(201);
    let list = await call("employee", "get", "/tasks");
    expect(list.body.data.items[0].actualQuantity).toBe(1);
    expect(list.body.data.items[0].status).toBe("In Progress");
    expect(
      (
        await call(
          "employee",
          "put",
          "/tasks/" + taskId + "/entries/" + entry.body.data._id,
          { identifier: "B", result: "Pending", values: { detail: "Updated" } },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "employee",
          "delete",
          "/tasks/" + taskId + "/entries/" + entry.body.data._id,
        )
      ).status,
    ).toBe(200);
    list = await call("employee", "get", "/tasks");
    expect(list.body.data.items[0].actualQuantity).toBe(0);
    await call("employee", "post", "/tasks/" + taskId + "/entries", {
      identifier: "C",
      result: "Good",
      values: { detail: "Final" },
    });
    expect(
      (
        await call("employee", "patch", "/tasks/" + taskId + "/progress", {
          status: "Completed",
          notes: "Complete",
        })
      ).status,
    ).toBe(200);
  });
  it("shows real manager and coordinator quantities and blocks manager writes", async () => {
    for (const role of ["manager", "coordinator"]) {
      const list = await call(role, "get", "/tasks");
      expect(list.body.data.items[0].status).toBe("Completed");
    }
    const overview = await call("manager", "get", "/overview");
    expect(overview.status).toBe(200);
    expect(overview.body.data.categories[0].quantity).toBe(1);
    expect(overview.body.data.categories[0].completed).toBe(1);
    const included = await call(
      "manager",
      "get",
      "/overview?from=2026-10-10&to=2026-10-10",
    );
    expect(included.body.data.categories[0].quantity).toBe(1);
    const excluded = await call(
      "manager",
      "get",
      "/overview?from=2026-10-12&to=2026-10-17",
    );
    expect(excluded.body.data.categories[0]).toMatchObject({
      tasks: 0,
      completed: 0,
      quantity: 0,
      target: 0,
    });
    expect(excluded.body.data.trend).toEqual([]);
    expect(
      (await call("manager", "get", "/overview?from=invalid")).status,
    ).toBe(422);
    const employees = await call("manager", "get", "/employees");
    expect(employees.body.data[0].quantity).toBe(1);
    expect(
      (
        await call("manager", "patch", "/tasks/" + taskId + "/progress", {
          status: "Not Started",
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("coordinator", "delete", "/tasks/" + taskId)).status,
    ).toBe(409);
  });
  it("rejects employee assignment changes, unassigned work, and mixed counting", async () => {
    expect((await call("employee", "put", "/tasks/" + taskId, {})).status).toBe(
      403,
    );

    expect(
      (
        await call("employee", "patch", "/tasks/" + taskId + "/progress", {
          aggregateQuantity: 5,
        })
      ).status,
    ).toBe(422);
  });
  it("handles targetless aggregate mode independently", async () => {
    const category = await call("coordinator", "post", "/categories", {
      name: "Aggregate",
      mode: "aggregate",
      targetBehavior: "none",
    });
    const task = await call("coordinator", "post", "/tasks", {
      categoryId: category.body.data._id,
      assignedEmployee: employeeId,
      title: "Aggregate",
      workDate: "2026-10-11",
    });
    expect(task.status).toBe(201);
    const path = "/tasks/" + task.body.data._id;
    expect(
      (await call("employee", "post", path + "/entries", { identifier: "No" }))
        .status,
    ).toBe(422);
    expect(
      (
        await call("employee", "patch", path + "/progress", {
          aggregateQuantity: 7,
        })
      ).status,
    ).toBe(200);
    const list = await call("employee", "get", "/tasks?day=2026-10-11");
    expect(list.body.data.items[0].actualQuantity).toBe(7);
    expect(list.body.data.items[0].target).toBeUndefined();
    expect(list.body.data.items[0].status).toBe("Not Started");
  });

  it("shares work globally while preventing writes to another employee's assignment", async () => {
    const second = await User.create({
      name: "Unassigned employee",
      email: "other@test.local",
      role: "employee",
      passwordHash: hashPassword("test-password"),
    });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "other@test.local", password: "test-password" });
    tokens.other = login.body.data.token;
    const employeeList = await call("coordinator", "get", "/employees");
    expect(
      employeeList.body.data.some(
        (u: { _id: string }) => u._id === String(second._id),
      ),
    ).toBe(true);
    expect((await call("other", "get", "/tasks")).body.data.total).toBe(0);
    expect((await call("other", "get", "/categories")).body.data.length).toBe(
      2,
    );
    expect(
      (
        await call("other", "patch", "/tasks/" + taskId + "/progress", {
          notes: "Denied",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("other", "post", "/tasks/" + taskId + "/entries", {
          identifier: "Denied",
        })
      ).status,
    ).toBe(404);
    expect((await call("coordinator", "get", "/teams")).status).toBe(404);
  });
  it("retains history and contribution ownership after reassignment", async () => {
    const second = await User.create({
      name: "Second",
      email: "second@test.local",
      role: "employee",
      passwordHash: hashPassword("test-password"),
    });
    await call("coordinator", "put", "/categories/" + categoryId, {
      name: "Attention",
      results: ["New"],
      targetBehavior: "none",
      active: false,
    });
    const changed = await call("coordinator", "put", "/tasks/" + taskId, {
      categoryId,
      assignedEmployee: String(second._id),
      title: "Review",
      workDate: "2026-10-10",
      target: 1,
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.categorySchema.version).toBe(1);
    expect(
      (
        await call("employee", "patch", "/tasks/" + taskId + "/progress", {
          notes: "Denied",
        })
      ).status,
    ).toBe(404);
    const history = await call("employee", "get", "/tasks?history=true");
    expect(history.body.data.total).toBe(2);
    expect(
      (await call("employee", "get", "/tasks/" + taskId + "/entries")).body.data
        .total,
    ).toBe(1);
    const people = await call("manager", "get", "/employees");
    expect(
      people.body.data.find((u: { _id: string }) => u._id === employeeId)
        .quantity,
    ).toBe(8);
    expect(
      people.body.data.find(
        (u: { _id: string }) => u._id === String(second._id),
      ).quantity,
    ).toBe(0);
  });
  it("creates a minimal assignment with blank employee fields and saves table work securely", async () => {
    const category = await call("coordinator", "post", "/categories", {
      name: "Table assignment",
      targetBehavior: "required",
    });
    const created = await call("coordinator", "post", "/tasks", {
      categoryId: category.body.data._id,
      assignedEmployee: employeeId,
      workDate: "2026-10-10",
      instructions: "Optional context",
    });
    expect(created.status).toBe(201);
    const task = created.body.data;
    expect(task).toMatchObject({
      title: "Table assignment",
      workFormat: "sheet",
      status: "",
      day: "",
      accountNames: "",
      resultStatus: "",
      notes: "",
    });
    expect(task.numDone).toBeUndefined();
    expect(task.endDate).toBeUndefined();
    const path = "/tasks/" + task._id;
    const work = {
      day: "Saturday",
      status: "Completed",
      endDate: "2026-10-11",
      accountNames: "Account A\nAccount B",
      numDone: 2,
      resultStatus: "Good",
      notes: "Checked",
    };
    for (const role of ["manager", "coordinator"])
      expect((await call(role, "patch", path + "/progress", work)).status).toBe(
        403,
      );
    expect(
      (
        await call("employee", "patch", path + "/progress", {
          ...work,
          assignedEmployee: employeeId,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call("employee", "patch", path + "/progress", {
          ...work,
          endDate: "2026-10-09",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call("employee", "post", path + "/entries", {
          identifier: "Hidden entry",
        })
      ).status,
    ).toBe(422);
    expect(
      (await call("employee", "patch", path + "/progress", work)).status,
    ).toBe(200);
    const listed = await call(
      "coordinator",
      "get",
      "/tasks?categoryId=" + category.body.data._id,
    );
    expect(listed.body.data.items[0]).toMatchObject({
      ...work,
      actualQuantity: 2,
    });
    for (const resultStatus of ["Pending", "Bad", "Good"]) {
      expect((await call("employee", "patch", path + "/progress", { resultStatus })).status).toBe(200);
      const stored = await Task.findById(task._id).lean();
      expect(stored?.resultStatus).toBe(resultStatus);
      const reloaded = await call("employee", "get", "/tasks?categoryId=" + category.body.data._id);
      expect(reloaded.body.data.items[0].resultStatus).toBe(resultStatus);
    }
    const overview = await call("manager", "get", "/overview");
    expect(
      overview.body.data.categories.find(
        (item: { _id: string }) => item._id === category.body.data._id,
      ).quantity,
    ).toBe(2);
    expect((await call("coordinator", "delete", path)).status).toBe(409);
    expect(
      (
        await call("employee", "patch", path + "/progress", {
          numDone: null,
          endDate: null,
        })
      ).status,
    ).toBe(200);
    const blanked = await call(
      "coordinator",
      "get",
      "/tasks?categoryId=" + category.body.data._id,
    );
    expect(blanked.body.data.items[0].actualQuantity).toBe(0);
    await Task.deleteOne({ _id: task._id });
    await call(
      "coordinator",
      "delete",
      "/categories/" + category.body.data._id,
    );
  });

  it("filters and paginates, revokes sessions, and has no legacy collections", async () => {
    const result = await call(
      "manager",
      "get",
      "/tasks?status=Completed&limit=1",
    );
    expect(result.body.data.total).toBe(1);
    expect(result.body.data.items).toHaveLength(1);
    expect(await Entry.countDocuments()).toBe(1);
    expect((await call("employee", "post", "/auth/logout")).status).toBe(200);
    expect((await call("employee", "get", "/auth/me")).status).toBe(401);
    expect(allModels.map((m) => m.collection.name).sort()).toEqual(
      [
        "users",
        "categories",
        "tasks",
        "task_entries",
        "weekly_financial_reports",
      ].sort(),
    );
  });
});
