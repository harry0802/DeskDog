import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DOM 由 tsconfig.json（lib 不含 DOM）把關；這裡把關套件 import。
const FORBIDDEN = /from\s+["'](electron|pixi\.js)(\/[^"']*)?["']/;

const sources = readdirSync(import.meta.dirname).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts")
);

describe("Pet core purity", () => {
  it.each(sources)("%s does not import Electron or PixiJS", (file) => {
    const code = readFileSync(join(import.meta.dirname, file), "utf8");
    expect(code).not.toMatch(FORBIDDEN);
  });
});
