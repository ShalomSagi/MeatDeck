import { describe, expect, it } from "vitest";
import { daysUntil } from "./DueChip.logic.ts";

describe("daysUntil", () => {
  it.each([
    ["2026-11-08", "2026-11-08", 0],
    ["2026-11-09", "2026-11-08", 1],
    ["2026-11-05", "2026-11-08", -3],
    ["2027-01-02", "2026-12-30", 3],
    // days with a daylight-saving change are 23 or 25 hours long and still count as one
    ["2026-03-30", "2026-03-28", 2],
    ["2026-11-02", "2026-10-31", 2],
  ])("due %s, today %s → %i", (due, today, want) => {
    expect(daysUntil(due, today)).toBe(want);
  });
});
