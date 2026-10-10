import mongoose from "mongoose";
import { configuration } from "./env.js";
let pending: Promise<typeof mongoose> | undefined;
export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 0) pending = undefined;
  const env = configuration();
  pending ??= mongoose
    .connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      autoIndex: env.NODE_ENV !== "production",
    })
    .catch((e) => {
      pending = undefined;
      throw e;
    });
  await pending;
}
export async function disconnectDatabase() {
  pending = undefined;
  await mongoose.disconnect();
}
