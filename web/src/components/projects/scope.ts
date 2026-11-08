import { sameRepo } from "../../../../shared/projects.ts";
import type { BoardEntry } from "../../board.ts";

export type Scope = { kind: "project"; id: string } | { kind: "repo"; repo: string } | null;

export function entriesIn(board: BoardEntry[], scope: Scope): BoardEntry[] {
  if (!scope) return board;
  return scope.kind === "project"
    ? board.filter((e) => e.projectIds.includes(scope.id))
    : board.filter((e) => e.repo && sameRepo(e.repo, scope.repo));
}
