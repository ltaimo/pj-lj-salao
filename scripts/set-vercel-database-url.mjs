import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targets = ["production", "preview", "development"];
const env = {};

for (const rawLine of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const [name, ...rest] = line.split("=");
  env[name.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
}

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing from .env");
}

const url = new URL(env.DATABASE_URL);
url.port = "6543";
url.searchParams.set("pgbouncer", "true");
url.searchParams.set("connection_limit", "1");
const pooledUrl = url.toString();

function run(args, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("npx.cmd", ["vercel", ...args], { cwd: root, shell: process.platform === "win32", stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (output += chunk.toString()));
    child.on("exit", (code) => (code === 0 ? resolvePromise(output) : reject(new Error(output))));
    if (input) child.stdin.write(`${input}\n`);
    child.stdin.end();
  });
}

for (const target of targets) {
  process.stdout.write(`replace DATABASE_URL ${target}\n`);
  await run(["env", "rm", "DATABASE_URL", target, "--yes"]).catch(() => undefined);
  await run(["env", "add", "DATABASE_URL", target], pooledUrl);
}

process.stdout.write("DATABASE_URL now uses transaction pooler for Vercel\n");
