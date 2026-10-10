import { rmSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import process from "node:process";
const root = fileURLToPath(new URL("..", import.meta.url));
const target = resolve(root, "dist");
if (relative(root, target) !== "dist")
  throw new Error("Build output must stay inside this repository");
rmSync(target, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [createRequire(import.meta.url).resolve("typescript/bin/tsc")],
  { cwd: root, stdio: "inherit" },
);
