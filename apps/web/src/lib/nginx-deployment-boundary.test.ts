import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync(
  new URL("../../../../deploy/nginx/indihub-nextjs.conf", import.meta.url),
  "utf8",
);

describe("non-Docker Nginx deployment configuration", () => {
  it("proxies Next.js and its static assets to the production web port", () => {
    expect(config).toContain("server 127.0.0.1:3000;");
    expect(config).toContain("location ^~ /_next/static/");
    expect(config).toContain("proxy_pass http://nextjs_upstream;");
    expect(config).not.toContain("/var/www/indihub/ecomm/");
  });
});
