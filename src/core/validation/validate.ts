import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export const validateBody = <T>(schema: ZodType<T>): RequestHandler => (req, _res, next) => {
  req.body = schema.parse(req.body) as unknown;
  next();
};
