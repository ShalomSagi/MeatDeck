import { describe, expect, it } from "vitest";
import { fmtPct, niceStep, paceOf, pct } from "./Usage.logic.ts";

describe("fmtPct", () => {
  it.each([
    [0, "0%"],
    [0.05, "<0.1%"],
    [0.1, "0.1%"],
    [9.94, "9.9%"],
    [10, "10%"],
    [66.6, "67%"],
  ])("%d → %s", (p, want) => {
    expect(fmtPct(p)).toBe(want);
  });

  it.each([
    [1, 4, 25],
    [5, 0, 0],
  ])("pct(%d, %d) = %d", (part, whole, want) => {
    expect(pct(part, whole)).toBe(want);
  });
});

describe("niceStep", () => {
  it.each([
    [0, 1],
    [0.4, 1],
    [1, 1],
    [1.5, 2],
    [3, 5],
    [7, 10],
    [12_000, 20_000],
    [333_333, 500_000],
  ])("%d → %d", (raw, want) => {
    expect(niceStep(raw)).toBe(want);
  });
});

describe("paceOf", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  // a 5-hour window that resets in 2.5 hours: half of it has gone by
  const half = { id: "five_hour" as const, label: "5h", minutes: 300, resetsAt: "2026-11-08T14:30:00Z" };
  it.each([
    [{ ...half, usedPercent: 50 }, "on"],
    [{ ...half, usedPercent: 55 }, "on"],
    [{ ...half, usedPercent: 56 }, "ahead"],
    [{ ...half, usedPercent: 44 }, "under"],
    // too early in the window to say
    [{ ...half, usedPercent: 50, resetsAt: "2026-11-08T16:58:00Z" }, undefined],
    [{ ...half, usedPercent: 50, resetsAt: undefined }, undefined],
  ])("%j → %s", (w, want) => {
    expect(paceOf(w, now)).toBe(want);
  });
});
