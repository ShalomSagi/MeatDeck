import { describe, expect, it } from "vitest";
import { elapsedBetween } from "./elapsed.ts";

describe("elapsedBetween", () => {
  const start = "2026-11-08T10:00:00.000Z";
  const at = (s: number) => Date.parse(start) + s * 1000;
  it.each([
    [0, "0s"],
    [59.9, "59s"],
    [60, "1m 00s"],
    [125, "2m 05s"],
    [3600, "1h 00m"],
    [3 * 3600 + 7 * 60 + 59, "3h 07m"],
    // a clock that ran backwards still reads 0s
    [-5, "0s"],
  ])("%ss → %s", (seconds, want) => {
    expect(elapsedBetween(start, at(seconds))).toBe(want);
  });

  it.each([
    ["not a date", Date.parse(start)],
    [start, Number.NaN],
  ])("%s to %s → null", (from, to) => {
    expect(elapsedBetween(from, to)).toBeNull();
  });
});
