import { describe, expect, it } from "vitest";
import type { Project } from "../../shared/types.ts";
import { navTarget, pageRefFor, pageTitle } from "./navigation.ts";

describe("navTarget", () => {
  it.each([
    ["today", undefined, "rules", { view: "today" }],
    ["settings", undefined, "rules", { view: "settings", settingsPage: "rules" }],
    ["settings", "schedule", "rules", { view: "settings", settingsPage: "schedule" }],
    // the footer's Integrations button opens that Settings page…
    ["integrations", undefined, "rules", { view: "settings", settingsPage: "integrations" }],
    // …and Settings from there goes back to General, not to Integrations again
    ["settings", undefined, "integrations", { view: "settings", settingsPage: "general" }],
  ] as const)("%s (page %s, on %s)", (v, page, current, want) => {
    expect(navTarget(v, page, current)).toEqual(want);
  });
});

describe("pageRefFor", () => {
  it.each([
    ["today", null, null, { type: "today" }],
    ["work", null, null, { type: "work" }],
    ["work", { kind: "project", id: "p1" }, null, { type: "project", id: "p1" }],
    ["work", { kind: "repo", repo: "acme/app" }, null, { type: "repo", repo: "acme/app" }],
    ["notes", null, "n1", { type: "note", id: "n1" }],
    ["notes", null, null, null],
    ["chat", null, null, null],
    ["settings", null, null, null],
  ] as const)("%s %j %s", (view, scope, noteId, want) => {
    expect(pageRefFor(view, scope, noteId)).toEqual(want);
  });
});

describe("pageTitle", () => {
  const state = {
    projects: [{ id: "p1", name: "Cutover" } as Project],
    notes: [
      { id: "n1", title: "Plan" },
      { id: "n2", title: "" },
    ] as never,
  };
  it.each([
    ["work", { kind: "project", id: "p1" }, null, "Cutover"],
    ["work", { kind: "project", id: "gone" }, null, "Project"],
    ["work", { kind: "repo", repo: "acme/app" }, null, "app"],
    ["work", null, null, "Work"],
    ["notes", null, "n1", "Plan"],
    ["notes", null, "n2", "Untitled"],
    ["notes", null, null, "Docs"],
    ["usage", null, null, "Usage"],
  ] as const)("%s %j %s → %s", (view, scope, noteId, want) => {
    expect(pageTitle(view, scope, noteId, state)).toBe(want);
  });
});
