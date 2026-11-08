import { describe, expect, it } from "vitest";
import { searchSettings } from "./SettingsView.logic.ts";
import type { Entry } from "./settingsSearch.tsx";

const entries: Entry[] = [
  { page: "general", title: "Model", hint: "Morning brief, wrap-up and sending", keywords: "claude opus" },
  { page: "general", title: "Small model", hint: "Pulse checks", keywords: "haiku cheap" },
  { page: "schedule", title: "Pulse checks", hint: "Cheap pass for what changed" },
  { page: "hidden", title: "acme/app", hint: "Hidden repo" },
];
const pages: Partial<Record<Entry["page"], string>> = { general: "General", schedule: "Schedule", hidden: "Hidden" };
const label = (page: Entry["page"]) => pages[page] ?? "";

describe("searchSettings", () => {
  it.each([
    ["", []],
    ["   ", []],
    // title prefix (4) beats title substring (3) beats hint/keywords (1)
    ["model", ["Model", "Small model"]],
    ["pulse", ["Pulse checks", "Small model"]],
    // every word must match somewhere
    ["cheap haiku", ["Small model"]],
    ["cheap nothing", []],
    // the page's name counts as a keyword
    ["hidden", ["acme/app"]],
    ["SCHEDULE", ["Pulse checks"]],
  ])("%j → %j", (query, want) => {
    expect(searchSettings(entries, query, label).map((e) => e.title)).toEqual(want);
  });

  it("returns at most 30 results", () => {
    const many: Entry[] = Array.from({ length: 40 }, (_, i) => ({ page: "general", title: `Rule ${i}` }));
    expect(searchSettings(many, "rule", label)).toHaveLength(30);
  });
});
