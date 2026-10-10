import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/modules/models.js";
import { hashPassword } from "../src/modules/auth/index.js";
const mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB_NAME = "ops_test_browser_v3";
process.env.AUTH_SECRET =
  "isolated-browser-secret-longer-than-thirty-two-characters";
process.env.FRONTEND_URL = "http://localhost:5173";
await connectDatabase();
for (const role of ["coordinator", "employee", "manager"]) {
  await User.create({
    name: role[0]!.toUpperCase() + role.slice(1),
    email: role + "@test.local",
    role,
    passwordHash: hashPassword("browser-test-password"),
  });
}
const server = createApp().listen(4101, "127.0.0.1", () =>
  console.log("Isolated browser API ready on 4101"),
);
async function shutdown() {
  server.close();
  await disconnectDatabase();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
