/* global process */

if (process.env.PORT && !process.env.API_PORT) {
  process.env.API_PORT = process.env.PORT;
}

await import("tsx/esm");
await import("./src/main.ts");
