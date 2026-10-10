import "dotenv/config";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { allModels } from "../src/modules/models.js";
const target = "ops_dev_blue_bug_v2";
const uri = new URL(process.env.MONGODB_URI ?? "");
if (
  !process.argv.includes("--execute") ||
  process.env.MONGODB_DB_NAME !== target ||
  (process.env.NODE_ENV ?? "development") !== "development" ||
  uri.protocol !== "mongodb+srv:" ||
  !uri.hostname.endsWith(".mongodb.net") ||
  !["", "/", "/" + target].includes(uri.pathname)
)
  throw new Error("Unverified development target: team removal refused");
const clean = (record: Record<string, unknown>) => {
  const copy = { ...record };
  delete copy.teamId;
  delete copy.teamIds;
  if (copy.categorySchema && typeof copy.categorySchema === "object") {
    copy.categorySchema = {
      ...(copy.categorySchema as Record<string, unknown>),
    };
    delete (copy.categorySchema as Record<string, unknown>).teamId;
    delete (copy.categorySchema as Record<string, unknown>).teamIds;
  }
  return copy;
};
const digest = (records: Record<string, unknown>[]) =>
  createHash("sha256")
    .update(JSON.stringify(records.map(clean)))
    .digest("hex");
try {
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: target,
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 8000,
  });
  const db = mongoose.connection.db!;
  if (db.databaseName !== target) throw new Error("Database identity mismatch");
  const before = new Map<string, { count: number; digest: string }>();
  for (const model of allModels) {
    const rows = await db
      .collection(model.collection.name)
      .find({})
      .sort({ _id: 1 })
      .toArray();
    before.set(model.collection.name, {
      count: rows.length,
      digest: digest(rows),
    });
  }
  const droppedIndexes: string[] = [];
  for (const model of allModels) {
    const collection = db.collection(model.collection.name);
    for (const index of await collection.indexes())
      if (
        Object.keys(index.key).some((k) => k === "teamId" || k === "teamIds")
      ) {
        await collection.dropIndex(index.name!);
        droppedIndexes.push(model.collection.name + ":" + index.name);
      }
    await collection.updateMany(
      {},
      {
        $unset: {
          teamId: "",
          teamIds: "",
          ...(model.collection.name === "tasks"
            ? { "categorySchema.teamId": "", "categorySchema.teamIds": "" }
            : {}),
        },
      },
    );
  }
  const deletedCollections: string[] = [];
  const names = (
    await db.listCollections({}, { nameOnly: true }).toArray()
  ).map((c) => c.name);
  for (const name of ["teams", "team_memberships"])
    if (names.includes(name)) {
      await db.dropCollection(name);
      deletedCollections.push(name);
    }
  for (const model of allModels) await model.createIndexes();
  const collections = [];
  for (const model of allModels) {
    const rows = await db
      .collection(model.collection.name)
      .find({})
      .sort({ _id: 1 })
      .toArray();
    const prior = before.get(model.collection.name)!;
    if (rows.length !== prior.count || digest(rows) !== prior.digest)
      throw new Error(
        "Content preservation failed for " + model.collection.name,
      );
    if (rows.some((r) => "teamId" in r || "teamIds" in r))
      throw new Error("Team references remain");
    collections.push({
      name: model.collection.name,
      count: rows.length,
      recordsPreserved: true,
    });
  }
  const report = {
    database: target,
    atlasVerified: true,
    executedAt: new Date().toISOString(),
    deletedCollections,
    droppedIndexes,
    collections,
    credentialsAndBusinessContentPreserved: true,
  };
  writeFileSync(
    "docs/remove-teams-result.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mongoose.disconnect();
}
