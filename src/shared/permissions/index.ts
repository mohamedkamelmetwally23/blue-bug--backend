import type { Actor } from "../../modules/auth/index.js";
import { ensure } from "../../modules/domain.js";
export function role(actor: Actor, expected: Actor["role"]) {
  ensure(actor.role === expected, 403, `${expected} access required`);
}
