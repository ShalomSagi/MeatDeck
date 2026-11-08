// Repo + project identity and matching, shared by the server (digest, guards) and the UI (board,
// sidebar) so both always agree. Pure code: this is how grouping stays free after Claude has
// taught a project its rules once.
import type { GithubPr, Message, OpenItem, Project, ProjectRules, Todo } from "./types.ts";

// ---------- repos ----------

/** "acme/app" from any github.com URL. */
export const repoOfUrl = (url?: string) => /github\.com\/([^/]+\/[^/#?]+)/.exec(url ?? "")?.[1];
export const repoShort = (repo: string) => repo.split("/").pop() ?? repo;

/** Repo names may be stored full ("owner/name") or short ("name"); compare either way. */
export function sameRepo(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || (!x.includes("/") && x === repoShort(y)) || (!y.includes("/") && y === repoShort(x));
}
export const repoIgnored = (repo: string | undefined, ignoredRepos: string[]) =>
  !!repo && ignoredRepos.some((r) => sameRepo(r, repo));

export const itemRepo = (i: Pick<OpenItem, "repo" | "url">) => i.repo ?? repoOfUrl(i.url);

// ---------- matching ----------

export const emptyRules = (): ProjectRules => ({
  repos: [],
  linearProjects: [],
  linearIssues: [],
  slackChannels: [],
  keywords: [],
});

/** Ticket keys like ENG-142 mentioned anywhere in the text. */
export const ticketKeys = (text: string) => [...new Set(text.match(/\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g) ?? [])];

const eq = (a: string, b: string) =>
  a.trim().replace(/^#/, "").toLowerCase() === b.trim().replace(/^#/, "").toLowerCase();

/** Anything that can belong to a project. */
export interface Matchable {
  key: string;
  title: string;
  text?: string;
  repo?: string;
  linearProject?: string;
  slackChannel?: string;
}

export function matchProjects(e: Matchable, projects: Project[], links: Record<string, string[]>): string[] {
  const out = new Set(links[e.key] ?? []);
  const haystack = `${e.key} ${e.title} ${e.text ?? ""}`;
  const keys = ticketKeys(haystack);
  const lower = haystack.toLowerCase();
  for (const p of projects) {
    const r = p.rules;
    if (
      (e.repo && r.repos.some((x) => sameRepo(x, e.repo!))) ||
      (e.linearProject && r.linearProjects.some((x) => eq(x, e.linearProject!))) ||
      (e.slackChannel && r.slackChannels.some((x) => eq(x, e.slackChannel!))) ||
      keys.some((k) => r.linearIssues.includes(k)) ||
      r.keywords.some((k) => k.trim().length >= 3 && lower.includes(k.trim().toLowerCase()))
    )
      out.add(p.id);
  }
  return [...out];
}

export const prEntity = (pr: GithubPr): Matchable => ({ key: pr.url, title: pr.title, repo: pr.repo });

export const itemEntity = (i: OpenItem): Matchable => ({
  key: i.id,
  title: i.title,
  text: [i.status, i.note].filter(Boolean).join(" "),
  repo: itemRepo(i),
  linearProject: i.source === "linear" ? i.project : undefined,
  slackChannel: i.source === "slack" ? i.project : undefined,
});

/** Everything the dashboard needs to place entities into projects. */
export interface ProjectIndex {
  projects: Project[];
  links: Record<string, string[]>;
  items: OpenItem[];
  prs: GithubPr[];
}

/** Todos and drafts inherit from the PR/item they point at, plus their own text. */
export function projectsOfTodo(t: Pick<Todo, "id" | "title" | "notes" | "url" | "itemId">, ix: ProjectIndex): string[] {
  const own = matchProjects(
    { key: `todo:${t.id}`, title: t.title, text: t.notes, repo: repoOfUrl(t.url) },
    ix.projects,
    ix.links,
  );
  return [...new Set([...own, ...inherited(t.url, t.itemId, ix)])];
}

export function projectsOfMessage(m: Pick<Message, "id" | "text" | "reason" | "url">, ix: ProjectIndex): string[] {
  const own = matchProjects(
    { key: `msg:${m.id}`, title: m.reason, text: m.text, repo: repoOfUrl(m.url) },
    ix.projects,
    ix.links,
  );
  return [...new Set([...own, ...inherited(m.url, undefined, ix)])];
}

function inherited(url: string | undefined, itemId: string | undefined, ix: ProjectIndex): string[] {
  const out: string[] = [];
  const pr = url ? ix.prs.find((p) => p.url === url) : undefined;
  if (pr) out.push(...matchProjects(prEntity(pr), ix.projects, ix.links));
  const item = ix.items.find((i) => (itemId && i.id === itemId) || (url && i.url === url));
  if (item) out.push(...matchProjects(itemEntity(item), ix.projects, ix.links));
  return out;
}

// ---------- ignore ----------

/** Hidden if its repo is ignored, or every project it belongs to is ignored. */
export function hiddenBy(
  repo: string | undefined,
  projectIds: string[],
  projects: Project[],
  ignoredRepos: string[],
): boolean {
  if (repoIgnored(repo, ignoredRepos)) return true;
  if (!projectIds.length) return false;
  return projectIds.every((id) => projects.find((p) => p.id === id)?.ignored);
}

// ---------- project priority (Linear's scale: 0 none, 1 urgent, 2 high, 3 medium, 4 low) ----------

export const PRIORITY_LABEL = ["No priority", "Urgent", "High", "Medium", "Low"] as const;
/** Score points a project's priority adds to each of its actions (code ranking, before Claude's overrides). */
const PRIORITY_BOOST = [0, 14, 8, 3, -6];

/** Your MeatDeck priority if set, else Linear's, else none. */
export function projectPriority(p: Pick<Project, "priority" | "linearPriority">): {
  level: number;
  from: "you" | "linear" | null;
} {
  if (p.priority !== undefined && p.priority !== null) return { level: p.priority, from: "you" };
  if (p.linearPriority) return { level: p.linearPriority, from: "linear" };
  return { level: 0, from: null };
}

/** Sort key: urgent first, none last. */
export const priorityRank = (level: number) => (level === 0 ? 5 : level);

/** The strongest priority among an action's projects (urgent beats low). */
export function topPriority(projectIds: string[], projects: Project[]): { level: number; project?: Project } {
  let best: { level: number; project?: Project } = { level: 0 };
  for (const id of projectIds) {
    const p = projects.find((x) => x.id === id);
    if (!p || p.ignored) continue;
    const { level } = projectPriority(p);
    if (level && (!best.level || level < best.level)) best = { level, project: p };
  }
  return best;
}

export const priorityBoost = (level: number) => PRIORITY_BOOST[level] ?? 0;
