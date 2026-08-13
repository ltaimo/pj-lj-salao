import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [name, ...rest] = line.split("=");
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    process.env[name.trim()] = value;
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/run-with-env.mjs <command> [...args]");
  process.exit(1);
}

const childCommand = process.platform === "win32" ? "cmd.exe" : command;
const childArgs = process.platform === "win32" ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args;

const child = spawn(childCommand, childArgs, {
  cwd: root,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code) => process.exit(code ?? 1));
