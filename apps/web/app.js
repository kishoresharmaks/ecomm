/* global console, process */

import { createServer } from "node:http";
import next from "next";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer((request, response) => {
  void handle(request, response);
}).listen(port, () => {
  console.log(`1HandIndia web listening on port ${port}`);
});
