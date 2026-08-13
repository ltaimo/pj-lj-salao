import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envPath = resolve(root, ".env");
const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_TTL",
  "JWT_REFRESH_TTL",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
  "WEB_ORIGIN"
];
const targets = ["production", "preview", "development"];

if (!existsSync(envPath)) {
  throw new Error(".env not found");
}

const env = {};
for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const [name, ...rest] = line.split("=");
  env[name.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
}

function run(command, args, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, shell: process.platform === "win32", stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (output += chunk.toString()));
    child.on("exit", (code) => {
      if (code === 0 || output.includes("already exists")) {
        resolvePromise(output);
      } else {
        reject(new Error(output));
      }
    });
    child.stdin.write(`${input}\n`);
    child.stdin.end();
  });
}

for (const name of required) {
  if (!env[name]) throw new Error(`${name} missing from .env`);
  for (const target of targets) {
    process.stdout.write(`sync ${name} ${target}\n`);
    await run("npx.cmd", ["vercel", "env", "add", name, target], env[name]);
  }
}

process.stdout.write("vercel env sync complete\n");
