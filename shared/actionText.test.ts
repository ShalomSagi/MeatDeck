import { describe, expect, it } from "vitest";
import { shortPrTitle } from "./actionText.ts";

describe("shortPrTitle", () => {
  it.each([
    ["feat(ui): add select, dropdown menu [ENG-118]", "Add select, dropdown menu"],
    ["fix!: crash on empty list (ENG-1/ENG-2)", "Crash on empty list"],
    ["ENG-123: move billing to the new API", "Move billing to the new API"],
    ["chore:   tidy   spacing", "Tidy spacing"],
    ["[ENG-5]", "[ENG-5]"],
  ])("%s → %s", (title, want) => {
    expect(shortPrTitle(title)).toBe(want);
  });

  it("cuts long titles at a word boundary and adds an ellipsis", () => {
    const out = shortPrTitle("refactor: " + "word ".repeat(30), 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out).not.toMatch(/\s…$/);
  });
});
