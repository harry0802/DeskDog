import { describe, expect, it } from "vitest";
import { LINE_POOLS, type Mood } from "../core/pet";
import lines from "./lines.json";

const MOODS: readonly Mood[] = [
  "happy",
  "normal",
  "lonely",
  "annoyed",
  "sulky",
  "sleepy",
];

describe("Line library", () => {
  it("has exactly the Line Pools the core knows", () => {
    expect(Object.keys(lines).sort()).toEqual([...LINE_POOLS].sort());
  });

  it.each(LINE_POOLS)("%s has non-empty Lines", (pool) => {
    const pooled: unknown[] = lines[pool];
    expect(pooled.length).toBeGreaterThan(0);
    for (const line of pooled) {
      expect(typeof line).toBe("string");
      expect(line).not.toBe("");
    }
  });

  it.each([...MOODS, "coldNormal" as const])(
    "%s has at least 5 Lines",
    (pool) => {
      expect(lines[pool].length).toBeGreaterThanOrEqual(5);
    }
  );
});
