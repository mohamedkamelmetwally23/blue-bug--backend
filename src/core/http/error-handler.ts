import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, "NOT_FOUND", "Route not found"));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: process.env.NODE_ENV === "production" ? "Internal server error" : message } });
};

