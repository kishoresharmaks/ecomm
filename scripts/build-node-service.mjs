import { readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [, , entryArg, outfileArg] = process.argv;

if (!entryArg || !outfileArg) {
  console.error("Usage: node scripts/build-node-service.mjs <entry> <outfile>");
  process.exit(1);
}

const cwd = process.cwd();
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entryPoint = resolve(cwd, entryArg);
const outfile = resolve(cwd, outfileArg);
const pnpmStore = resolve(repoRoot, "node_modules", ".pnpm");
const esbuildPackageDir = readdirSync(pnpmStore).find((entry) => entry.startsWith("esbuild@"));

if (!esbuildPackageDir) {
  console.error("Could not find esbuild in node_modules/.pnpm. Run pnpm install before building.");
  process.exit(1);
}

const esbuildBin = resolve(pnpmStore, esbuildPackageDir, "node_modules", "esbuild", "bin", "esbuild");

await mkdir(dirname(outfile), { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    esbuildBin,
    entryPoint,
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node22",
    `--outfile=${outfile}`,
    "--sourcemap",
    "--banner:js=import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    "--external:@clerk/backend",
    "--external:@nestjs/*",
    "--external:bullmq",
    "--external:class-transformer",
    "--external:class-transformer/*",
    "--external:class-validator",
    "--external:helmet",
    "--external:ioredis",
    "--external:libphonenumber-js",
    "--external:nodemailer",
    "--external:pino",
    "--external:reflect-metadata",
    "--external:rxjs",
    "--external:rxjs/*",
    "--external:socket.io",
    "--external:zod",
    "--log-level=info"
  ],
  { stdio: "inherit" }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Built ${outfile}`);
