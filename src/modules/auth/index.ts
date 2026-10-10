import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { configuration } from "../../config/env.js";
import { User } from "../models.js";
import { ensure } from "../domain.js";
export type Actor = {
  id: string;
  role: "manager" | "coordinator" | "employee";
  name: string;
  email: string;
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  const [salt, encoded] = hash.split(":");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "hex"),
    actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function login(email: string, password: string) {
  const window = Math.floor(Date.now() / 900000);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase(), active: true },
    [
      {
        $set: {
          loginAttempts: {
            $cond: [
              { $eq: ["$loginWindow", window] },
              { $add: [{ $ifNull: ["$loginAttempts", 0] }, 1] },
              1,
            ],
          },
          loginWindow: window,
        },
      },
    ],
    { new: true },
  ).select("+passwordHash");
  ensure(
    !user || user.get("loginAttempts") <= 20,
    429,
    "Too many sign-in attempts. Try again in 15 minutes.",
  );
  const valid = verifyPassword(
    password,
    user?.get("passwordHash") ??
      "00000000000000000000000000000000:" + "00".repeat(64),
  );
  ensure(user && valid, 401, "Invalid email or password");
  await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 0 } });
  const token = await new SignJWT({ version: user.get("sessionVersion") })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user._id))
    .setIssuer("blue-bug")
    .setAudience("operations")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(configuration().AUTH_SECRET));
  return {
    token,
    user: {
      id: String(user._id),
      name: user.get("name"),
      email: user.get("email"),
      role: user.get("role"),
    },
  };
}
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    ensure(token, 401, "Sign in required");
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(configuration().AUTH_SECRET),
      { issuer: "blue-bug", audience: "operations", algorithms: ["HS256"] },
    );
    const user = await User.findOne({
      _id: payload.sub,
      active: true,
      sessionVersion: payload.version,
    });
    ensure(user, 401, "Session expired");
    res.locals.actor = {
      id: String(user._id),
      name: user.get("name"),
      email: user.get("email"),
      role: user.get("role"),
    } satisfies Actor;
    next();
  } catch {
    res
      .status(401)
      .json({ error: { message: "Sign in required or session expired" } });
  }
}
