import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, writeJson } from "./store";

const dir = () => mkdtempSync(join(tmpdir(), "deskdog-"));

describe("store", () => {
  it("writes JSON that reads back, leaving no temporary file", () => {
    const folder = dir();
    const file = join(folder, "pet-state.json");

    writeJson(file, { affection: 60 });

    expect(readJson(file)).toEqual({ affection: 60 });
    expect(readdirSync(folder)).toEqual(["pet-state.json"]);
  });

  it.each([
    { case: "missing", content: undefined },
    { case: "corrupt", content: '{"affection": 6' },
  ])("reads a $case file as undefined", ({ content }) => {
    const file = join(dir(), "pet-state.json");
    if (content !== undefined) writeFileSync(file, content);

    expect(readJson(file)).toBeUndefined();
  });
});
