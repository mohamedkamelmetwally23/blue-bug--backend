import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { configuration } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { router } from "./modules/routes.js";
import { DomainError } from "./modules/domain.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || origin === configuration().FRONTEND_URL),
    }),
  );
  app.use(express.json({ limit: "128kb" }));
  app.get("/api/v1/health", (_req, res) =>
    res.json({ data: { status: "ok" } }),
  );
  app.use("/api/v1", async (_req, _res, next) => {
    await connectDatabase();
    next();
  });
  app.use("/api/v1", router);
  app.use((_req, res) =>
    res.status(404).json({ error: { message: "Endpoint not found" } }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (typeof error === "object" && error !== null && "type" in error) {
        if (error.type === "entity.parse.failed")
          return res
            .status(400)
            .json({ error: { message: "Invalid JSON body" } });
        if (error.type === "entity.too.large")
          return res
            .status(413)
            .json({ error: { message: "Request body is too large" } });
      }
      if (error instanceof ZodError)
        return res.status(422).json({
          error: {
            message: "Invalid request",
            issues: error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
        });
      if (error instanceof Error && error.name === "VersionError")
        return res.status(409).json({
          error: { message: "This record changed. Refresh and retry." },
        });
      if (error instanceof DomainError)
        return res
          .status(error.status)
          .json({ error: { message: error.message } });
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      )
        return res.status(409).json({
          error: { message: "Record already exists. Refresh and retry." },
        });
      return res
        .status(500)
        .json({ error: { message: "Request could not be completed" } });
    },
  );
  return app;
}
export default createApp();
