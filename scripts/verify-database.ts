import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { configuration } from "../src/config/env.js";
import { allModels } from "../src/modules/models.js";
import mongoose from "mongoose";
import { writeFileSync } from "node:fs";
try {
  const env = configuration();
  await connectDatabase();
  const names = (
    await mongoose.connection
      .db!.listCollections({}, { nameOnly: true })
      .toArray()
  )
    .map((c) => c.name)
    .sort();
  const expected = allModels.map((m) => m.collection.name).sort();
  const unexpected = names.filter((n) => !expected.includes(n));
  const collections = await Promise.all(
    allModels.map(async (m) => ({
      name: m.collection.name,
      count: await m.countDocuments(),
      indexes: (await m.collection.indexes()).map((i) => ({
        name: i.name,
        key: i.key,
        unique: i.unique ?? false,
      })),
    })),
  );
  const report = {
    database: env.MONGODB_DB_NAME,
    verifiedAt: new Date().toISOString(),
    unexpectedCollections: unexpected,
    collections,
  };
  console.log(JSON.stringify(report, null, 2));
  if (unexpected.length) throw new Error("Unexpected collections remain");
  if (env.MONGODB_DB_NAME === "ops_dev_blue_bug_v2") {
    writeFileSync(
      "docs/database-verification-v3.json",
      JSON.stringify(report, null, 2),
    );
  }
} catch {
  console.error(
    "Database verification failed; no destructive changes attempted.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
