// Every export of a "use server" file becomes a public HTTP endpoint. This
// test fails if one is added without going through guardedAction, unless it
// is on the short list of deliberately public actions.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const publicActions = new Set(["startGoogleSignIn", "signOut"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
}

const serverActionFiles = sourceFiles(join(process.cwd(), "src")).filter(
  (file) => /^\s*["']use server["']/.test(readFileSync(file, "utf8")),
);

describe("server action files", () => {
  it("exist (the scan is looking in the right place)", () => {
    expect(serverActionFiles.length).toBeGreaterThan(0);
  });

  it.each(
    serverActionFiles.map((file) => [relative(process.cwd(), file), file]),
  )(
    "%s exports only guarded or deliberately public actions",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const exportLines = source
        .split("\n")
        .filter((line) => line.startsWith("export "));

      for (const line of exportLines) {
        if (
          line.startsWith("export type ") ||
          line.startsWith("export interface ")
        )
          continue;

        const guarded = line.match(/^export const (\w+) = guardedAction\(/);
        if (guarded) continue;

        const publicFn = line.match(/^export async function (\w+)/);
        expect(
          publicFn && publicActions.has(publicFn[1]),
          `Unguarded export: ${line}`,
        ).toBe(true);
      }
    },
  );
});
