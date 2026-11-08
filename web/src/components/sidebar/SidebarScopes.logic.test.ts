import { describe, expect, it } from "vitest";
import type { Project } from "../../../../shared/types.ts";
import type { BoardEntry } from "../../board.ts";
import { rankProjects, rankRepos, recentNotes } from "./SidebarScopes.logic.ts";

const entry = (projectIds: string[], repo?: string, needsMe = false) =>
  ({ projectIds, repo, state: needsMe ? "needs_me" : "waiting" }) as BoardEntry;

const project = (id: string, extra: Partial<Project> = {}) => ({ id, name: id, kind: "linear", ...extra }) as Project;

describe("recentNotes", () => {
  it("puts pinned docs first, then the newest, and keeps five", () => {
    const notes = [
      { id: "old", updatedAt: "2026-01-01" },
      { id: "pinned-old", updatedAt: "2025-01-01", pinned: true },
      { id: "new", updatedAt: "2026-03-01" },
      { id: "a", updatedAt: "2026-02-01" },
      { id: "b", updatedAt: "2026-02-02" },
      { id: "c", updatedAt: "2026-02-03" },
    ];
    expect(recentNotes(notes).map((n) => n.id)).toEqual(["pinned-old", "new", "c", "b", "a"]);
  });
});

describe("rankProjects", () => {
  const board = [entry(["busy"]), entry(["busy"], undefined, true), entry(["quiet"]), entry(["urgent"])];

  it.each([
    [
      "priority first, none last",
      [project("busy"), project("urgent", { linearPriority: 1 }), project("quiet", { priority: 3 })],
      ["urgent", "quiet", "busy"],
    ],
    [
      "same priority: yours before Linear's, then needs-me, then size",
      [project("quiet"), project("busy"), project("mine", { kind: "manual" })],
      ["mine", "busy", "quiet"],
    ],
    [
      "hidden projects and empty Linear projects drop out",
      [project("busy", { ignored: true }), project("empty"), project("quiet")],
      ["quiet"],
    ],
  ])("%s", (_, projects, want) => {
    expect(rankProjects(projects, board).map((x) => x.p.id)).toEqual(want);
  });

  it("counts open and needs-me entries", () => {
    expect(rankProjects([project("busy")], board)[0]).toMatchObject({ total: 2, needsMe: 1 });
  });
});

describe("rankRepos", () => {
  it("lists each repo once, needs-me first, then by size", () => {
    const board = [
      entry([], "acme/big"),
      entry([], "acme/big"),
      entry([], "acme/hot", true),
      entry([], "acme/small"),
      entry([]),
    ];
    expect(rankRepos(board)).toEqual([
      { repo: "acme/hot", total: 1, needsMe: 1 },
      { repo: "acme/big", total: 2, needsMe: 0 },
      { repo: "acme/small", total: 1, needsMe: 0 },
    ]);
  });
});
