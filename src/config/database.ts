import mongoose from "mongoose";
import { env } from "./env.js";

let connectionPromise: Promise<void> | undefined;

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;
  connectionPromise ??= mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME })
    .then(() => undefined)
    .catch((error: unknown) => {
      connectionPromise = undefined;
      throw error;
    });
  await connectionPromise;
};

export const disconnectDatabase = async (): Promise<void> => mongoose.disconnect();

