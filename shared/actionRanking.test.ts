import { describe, expect, it } from "vitest";
import { workDaysSince } from "./actionRanking.ts";

describe("workDaysSince", () => {
  const SUN_TO_THU = [0, 1, 2, 3, 4];
  const at = (d: number, h = 0) => new Date(2026, 10, d, h); // Nov 2026: the 8th is a Sunday

  it("counts only configured work days", () => {
    // Thu 12:00 → Sun 12:00: half of Thursday, Fri+Sat skipped, half of Sunday.
    expect(workDaysSince(at(12, 12).toISOString(), SUN_TO_THU, at(15, 12))).toBeCloseTo(1);
  });

  it("is zero for future or invalid dates", () => {
    expect(workDaysSince(at(20).toISOString(), SUN_TO_THU, at(10))).toBe(0);
    expect(workDaysSince("not a date", SUN_TO_THU, at(10))).toBe(0);
  });
});
