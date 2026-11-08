import { describe, expect, it } from "vitest";
import type { BoardEntry } from "../../board.ts";
import { entriesIn, type Scope } from "./scope.ts";

const board = [
  { key: "a", projectIds: ["p1"], repo: "acme/app" },
  { key: "b", projectIds: ["p1", "p2"] },
  { key: "c", projectIds: [], repo: "ACME/App" },
  { key: "d", projectIds: [], repo: "acme/api" },
] as BoardEntry[];

describe("entriesIn", () => {
  it.each<[Scope, string[]]>([
    [null, ["a", "b", "c", "d"]],
    [{ kind: "project", id: "p1" }, ["a", "b"]],
    [{ kind: "project", id: "p2" }, ["b"]],
    [{ kind: "repo", repo: "acme/app" }, ["a", "c"]],
    [{ kind: "repo", repo: "app" }, ["a", "c"]],
  ])("%j", (scope, want) => {
    expect(entriesIn(board, scope).map((e) => e.key)).toEqual(want);
  });
});
