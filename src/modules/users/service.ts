import { z } from "zod";
import { hashPassword, type Actor } from "../auth/index.js";
import { User } from "../models.js";
import { role } from "../../shared/permissions/index.js";

export async function createEmployee(actor: Actor, input: unknown) {
  role(actor, "coordinator");
  const data = z
    .object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().email().max(200).toLowerCase(),
      password: z.string().min(8).max(200),
    })
    .strict()
    .parse(input);
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: hashPassword(data.password),
    role: "employee",
    active: true,
  });
  return {
    _id: user._id,
    name: user.get("name"),
    email: user.get("email"),
    role: "employee",
    active: true,
  };
}
