import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const allowedDirectLocationApiUsers = new Set([
  normalizePath("src/components/locations/location-store.ts"),
  normalizePath("src/lib/location-api.ts"),
]);

describe("location data access guard", () => {
  it("keeps location option fetching centralized through the shared location store", () => {
    const srcRoot = join(process.cwd(), "src");
    const directUsers = listSourceFiles(srcRoot)
      .filter((filePath) => {
        const relativePath = normalizePath(relative(process.cwd(), filePath));
        if (allowedDirectLocationApiUsers.has(relativePath)) {
          return false;
        }

        const source = readFileSync(filePath, "utf8");
        return /listLocation(?:Countries|States|Cities|Areas)\b/.test(source);
      })
      .map((filePath) => normalizePath(relative(process.cwd(), filePath)));

    expect(directUsers).toEqual([]);
  });
});

function listSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((entry) => {
    const entryPath = join(root, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [entryPath] : [];
  });
}

function normalizePath(value: string) {
  return value.split(sep).join("/");
}
