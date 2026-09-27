import cors from "cors";
import express from "express";
import * as helmetModule from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./core/http/error-handler.js";
import { googleSheetsRouter } from "./features/google-sheets/google-sheets.routes.js";
import { overviewRouter } from "./features/overview/overview.routes.js";
import { taskRouter } from "./features/tasks/task.routes.js";
import { weekRouter } from "./features/weeks/week.routes.js";

const createHelmet = helmetModule.default as unknown as () => express.RequestHandler;

export const createApp = () => {
  const app = express();
  app.use(createHelmet()); app.use(cors()); app.use(express.json({ limit: "1mb" })); app.use(pinoHttp());
  app.get(`${env.API_PREFIX}/health`, (_req, res) => res.json({ status: "ok" }));
  app.use(`${env.API_PREFIX}/overview`, overviewRouter);
  app.use(`${env.API_PREFIX}/tasks`, taskRouter);
  app.use(`${env.API_PREFIX}/weeks`, weekRouter);
  app.use(`${env.API_PREFIX}/google-sheets`, googleSheetsRouter);
  app.use(notFound); app.use(errorHandler);
  return app;
};

