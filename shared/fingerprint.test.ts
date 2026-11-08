import { describe, expect, it } from "vitest";
import { changedFiles, compareVersions } from "./fingerprint.ts";

describe("compareVersions", () => {
  it.each([
    ["1.2.0", "1.1.9", 1],
    ["1.10.0", "1.9.0", 1],
    ["v1.2.0", "1.2.0", 0],
    ["1.2", "1.2.0", 0],
    ["1.2.0", "1.2.0-beta", 1],
    ["1.2.0-alpha", "1.2.0-beta", -1],
    ["0.2.0-alpha.10", "0.2.0-alpha.9", 1],
    ["0.1.0-alpha", "0.2.0-alpha", -1],
  ])("%s vs %s → %i", (a, b, want) => {
    expect(compareVersions(a, b)).toBe(want);
    expect(compareVersions(b, a)).toBe(-want || 0);
  });
});

describe("changedFiles", () => {
  it("lists added, removed and changed files, sorted", () => {
    expect(changedFiles({ a: "1", b: "2", c: "3" }, { c: "3", b: "9", d: "4" })).toEqual(["a", "b", "d"]);
  });
});
