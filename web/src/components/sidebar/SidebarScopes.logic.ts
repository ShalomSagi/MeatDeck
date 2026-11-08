import { priorityRank, projectPriority } from "../../../../shared/projects.ts";
import type { NoteMeta, Project } from "../../../../shared/types.ts";
import type { BoardEntry } from "../../board.ts";
import { entriesIn } from "../projects/scope.ts";

const counts = (entries: BoardEntry[]) => ({
  total: entries.length,
  needsMe: entries.filter((e) => e.state === "needs_me").length,
});

/** Pinned docs, then the most recent ones: a short list; the Docs page has everything. */
export function recentNotes<T extends Pick<NoteMeta, "pinned" | "updatedAt">>(notes: T[]): T[] {
  return [...notes]
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
}

/** Visible projects with their open-work counts, highest priority first. */
export function rankProjects(projects: Project[], board: BoardEntry[]) {
  return (
    projects
      .filter((p) => !p.ignored)
      .map((p) => ({ p, ...counts(entriesIn(board, { kind: "project", id: p.id })) }))
      // Your projects always show; Linear projects only when they have open work.
      .filter((x) => x.p.kind === "manual" || x.total > 0)
      .sort(
        (a, b) =>
          priorityRank(projectPriority(a.p).level) - priorityRank(projectPriority(b.p).level) ||
          Number(b.p.kind === "manual") - Number(a.p.kind === "manual") ||
          b.needsMe - a.needsMe ||
          b.total - a.total,
      )
  );
}

/** Every repo with open work, the ones that need you first. */
export function rankRepos(board: BoardEntry[]) {
  const names = new Set<string>();
  for (const e of board) if (e.repo) names.add(e.repo);
  return [...names]
    .map((repo) => ({ repo, ...counts(entriesIn(board, { kind: "repo", repo })) }))
    .sort((a, b) => b.needsMe - a.needsMe || b.total - a.total);
}
