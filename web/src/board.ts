import type { Action } from "../../shared/actions.ts";
import { hiddenBy, itemEntity, itemRepo, matchProjects, prEntity } from "../../shared/projects.ts";
import { isBot, type DashboardState, type ItemState, type OpenItem, type Source } from "../../shared/types.ts";
import type { BadgeVariant } from "./components/ui.tsx";
import { ago, people, prNeedsMe, prSignals } from "./lib.ts";

/** One row on the "where things stand" board — a Claude-tracked item or a live GitHub PR. */
export interface BoardEntry {
  key: string;
  source: Source;
  kind: OpenItem["kind"];
  title: string;
  url?: string;
  /** GitHub repo "owner/name", when it lives in code. */
  repo?: string;
  /** Projects it belongs to (rules + links), resolved by shared code. */
  projectIds: string[];
  projectNames?: string[];
  /** Source-side group shown when there's no project (Linear project / Slack channel). */
  group?: string;
  state: ItemState;
  badges: { label: string; variant: BadgeVariant }[];
  waitingOn?: string;
  note?: string;
  updatedAt: string;
  live: boolean;
  itemId?: string;
}

export const STATE_META: Record<
  Exclude<ItemState, "done">,
  { label: string; hint: string; tone: "error" | "warning" | "info" | "muted" }
> = {
  needs_me: { label: "Needs you", hint: "The ball is in your court", tone: "error" },
  blocked: { label: "Blocked", hint: "Can't move until something changes", tone: "warning" },
  waiting: { label: "Waiting on others", hint: "Chase if it's been too long", tone: "info" },
  in_progress: { label: "In progress", hint: "Moving", tone: "muted" },
};

export function buildBoard(state: DashboardState): BoardEntry[] {
  const entries: BoardEntry[] = [];
  const seen = new Set<string>();

  for (const pr of state.github.mine) {
    const signals = prSignals(pr);
    const tracked = state.items.find((i) => i.url === pr.url);
    seen.add(pr.url);
    entries.push({
      key: pr.id,
      source: "github",
      kind: "pr",
      title: pr.title,
      url: pr.url,
      repo: pr.repo,
      projectIds: matchProjects(prEntity(pr), state.projects, state.projectLinks),
      state: pr.isDraft
        ? "in_progress"
        : prNeedsMe(pr)
          ? "needs_me"
          : pr.pendingReviewers.length
            ? "waiting"
            : "in_progress",
      badges: [{ label: `#${pr.number}`, variant: "outline" }, ...signals],
      waitingOn: signals.some((s) => !s.mine) ? people(pr.pendingReviewers) : undefined,
      note: tracked?.note,
      updatedAt: pr.updatedAt,
      live: true,
    });
  }

  // Bot PRs (dependabot, renovate) stay on the Pull requests page only.
  for (const pr of state.github.reviewRequests.filter((p) => !isBot(p.author))) {
    seen.add(pr.url);
    entries.push({
      key: `review-${pr.id}`,
      source: "github",
      kind: "review",
      title: pr.title,
      url: pr.url,
      repo: pr.repo,
      projectIds: matchProjects(prEntity(pr), state.projects, state.projectLinks),
      state: "needs_me",
      badges: [
        { label: `#${pr.number}`, variant: "outline" },
        { label: `Review for ${pr.author} · ${ago(pr.createdAt)}`, variant: "primary" },
      ],
      updatedAt: pr.updatedAt,
      live: true,
    });
  }

  for (const item of state.items) {
    if (item.url && seen.has(item.url)) continue;
    if (item.state === "done") continue;
    entries.push({
      key: item.id,
      itemId: item.id,
      source: item.source,
      kind: item.kind,
      title: item.title,
      url: item.url,
      repo: itemRepo(item),
      projectIds: matchProjects(itemEntity(item), state.projects, state.projectLinks),
      group: item.project,
      state: item.state,
      badges: item.status ? [{ label: item.status, variant: "default" }] : [],
      waitingOn: item.waitingOn,
      note: item.note,
      updatedAt: item.updatedAt,
      live: false,
    });
  }

  // Hidden repos/projects disappear everywhere (ignored repos are already excluded server-side).
  const { ignoredRepos } = state.settings;
  const names = new Map(state.projects.map((p) => [p.id, p.name]));
  for (const e of entries) e.projectNames = e.projectIds.map((id) => names.get(id)).filter((n): n is string => !!n);
  return entries
    .filter((e) => !hiddenBy(e.repo, e.projectIds, state.projects, ignoredRepos))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Board entries that aren't already in the action queue (so lists don't repeat the same PR). */
export function withoutActions(entries: BoardEntry[], actions: Action[]): BoardEntry[] {
  const urls = new Set(actions.map((a) => a.url).filter(Boolean));
  const items = new Set(actions.map((a) => a.itemId).filter(Boolean));
  return entries.filter((e) => !(e.url && urls.has(e.url)) && !(e.itemId && items.has(e.itemId)));
}
