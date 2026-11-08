// The compact view of the dashboard that Claude reads, via get_dashboard and
// injected into scheduled runs' prompts. Only fields Claude acts on; no logs,
// no run history, no raw API payloads. One line per PR.
import {
  hiddenBy,
  itemEntity,
  itemRepo,
  matchProjects,
  prEntity,
  projectsOfMessage,
  projectsOfTodo,
  repoIgnored,
  repoOfUrl,
  PRIORITY_LABEL,
  priorityRank,
  projectPriority,
} from "../shared/projects.ts";
import { isBot, type GithubPr, type RunKind } from "../shared/types.ts";
import { buildActions, type Action } from "../shared/actions.ts";
import { prStacks, stackReviewGaps } from "../shared/prStacks.ts";
import { github } from "./github.ts";
import { localDate } from "./store/helpers.ts";
import { store } from "./store/store.ts";

const ago = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  return h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
};

/** Compact list for Claude's digest: enough to re-prioritize, nothing more. */
const PRIORITY_NAMES = ["none", "urgent", "high", "medium", "low"];

function actionsForClaude(actions: Action[]) {
  return actions.slice(0, 45).map((a) => ({
    key: a.key,
    verb: a.verb,
    ball: a.ball,
    tier: a.tier,
    title: a.title,
    ...(a.why ? { why: a.why.slice(0, 140) } : {}),
    ...(a.due ? { due: a.due } : {}),
    ...(a.priority ? { projectPriority: PRIORITY_NAMES[a.priority] } : {}),
    ...(a.by === "claude" ? { yours: true } : {}),
    // Draft the nudge with this url so it becomes this row's "send" step.
    ...(a.key.startsWith("stack:") ? { draftUrl: a.url } : {}),
  }));
}

const people = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(",")}+${xs.length - 3}` : xs.join(","));

function prLine(pr: GithubPr, review = false): string {
  const parts = [`${pr.repo.split("/")[1]}#${pr.number}`, JSON.stringify(pr.title)];
  if (review) parts.push(`by=${pr.author}`, `opened=${ago(pr.createdAt)}`);
  if (pr.isDraft) parts.push("draft");
  if (pr.checks) parts.push(`ci=${pr.checks.toLowerCase()}`);
  if (pr.failingChecks?.length) parts.push(`failing=${people(pr.failingChecks)}`);
  if (!review && pr.reviewDecision) parts.push(`review=${pr.reviewDecision.toLowerCase()}`);
  if (pr.approvedBy.length) parts.push(`approved=${people(pr.approvedBy)}`);
  if (pr.changesRequestedBy.length) parts.push(`changes=${people(pr.changesRequestedBy)}`);
  if (!review && pr.pendingReviewers.length) parts.push(`waiting=${people(pr.pendingReviewers)}`);
  if (pr.unresolvedThreads) parts.push(`threads=${pr.unresolvedThreads}`);
  if (pr.mergeable === "CONFLICTING") parts.push("conflicts");
  parts.push(`updated=${ago(pr.updatedAt)}`, pr.url);
  return parts.join(" ");
}

/** Local "YYYY-MM-DD HH:MM" (ISO strings are UTC; Claude should reason in the user's time). */
const local = (iso: string) => {
  const d = new Date(iso);
  return `${localDate(d)} ${d.toTimeString().slice(0, 5)}`;
};

function lastClaudeRun(): string | undefined {
  return (["morning", "manual", "pulse", "wrapup"] as RunKind[])
    .map((k) => store.lastRun(k))
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);
}

export function digest(opts: { focusProjectId?: string } = {}) {
  const day = store.today();
  const since = lastClaudeRun();
  const d = new Date();
  const projects = store.projects();
  const links = store.links();
  const ignoredRepos = store.settings().ignoredRepos;
  const ix = { projects, links, items: store.items(), prs: [...github.mine, ...github.reviewRequests] };
  // Highest priority first, so Claude reads the most important projects first.
  const active = projects
    .filter((p) => !p.ignored)
    .sort((a, b) => priorityRank(projectPriority(a).level) - priorityRank(projectPriority(b).level));
  const pj = (ids: string[]) => ids.filter((id) => active.some((p) => p.id === id));

  // Hidden things never reach Claude: nothing to read means no tokens spent on them.
  const items = ix.items
    .map((i) => ({ i, ids: matchProjects(itemEntity(i), projects, links) }))
    .filter(({ i, ids }) => !hiddenBy(itemRepo(i), ids, projects, ignoredRepos));
  const prs = (list: GithubPr[]) =>
    list
      .map((p) => ({ p, ids: matchProjects(prEntity(p), projects, links) }))
      .filter(({ p, ids }) => !hiddenBy(p.repo, ids, projects, []));
  const myPrs = prs(github.mine);
  const reviewPrs = prs(github.reviewRequests.filter((p) => !isBot(p.author)));
  const todos = day.todos
    .map((t) => ({ t, ids: projectsOfTodo(t, ix) }))
    .filter(({ t, ids }) => !hiddenBy(repoOfUrl(t.url), ids, projects, ignoredRepos));
  const messages = day.messages
    .map((m) => ({ m, ids: projectsOfMessage(m, ix) }))
    .filter(({ m, ids }) => !hiddenBy(repoOfUrl(m.url), ids, projects, ignoredRepos));
  const events = store.events().filter((e) => !repoIgnored(repoOfUrl(e.url), ignoredRepos));
  const tag = (ids: string[]) => (pj(ids).length ? { pj: pj(ids) } : {});

  // Work no project rule matched yet: for grouping into manual projects, and for spotting active
  // work that deserves a project of its own (suggest_project).
  const unassigned = [
    ...myPrs.filter((x) => !pj(x.ids).length).map((x) => `${x.p.url} ${JSON.stringify(x.p.title)}`),
    ...reviewPrs.filter((x) => !pj(x.ids).length).map((x) => `${x.p.url} ${JSON.stringify(x.p.title)}`),
    ...items.filter((x) => !pj(x.ids).length).map((x) => `${x.i.id} ${JSON.stringify(x.i.title)}`),
  ].slice(0, 40);

  const focus = opts.focusProjectId ? projects.find((p) => p.id === opts.focusProjectId) : undefined;

  return {
    now: `${localDate(d)} ${d.toTimeString().slice(0, 5)} ${d.toLocaleDateString("en-US", { weekday: "short" })}`,
    lastRuns: Object.fromEntries(
      (["morning", "manual", "pulse", "wrapup"] as RunKind[]).flatMap((k) => {
        const v = store.lastRun(k);
        return v ? [[k, local(v)]] : [];
      }),
    ),
    // The queue the user sees, ranked by code (by: code) or by you earlier (yours: true). Re-rank with set_priorities.
    actions: actionsForClaude(currentQueue()),
    // Rules learned from the user's corrections. Follow them.
    ...(store.preferences().length ? { preferences: store.preferences().map((p) => p.text) } : {}),
    ...(focus
      ? {
          focusProject: {
            id: focus.id,
            name: focus.name,
            description: focus.description,
            rules: focus.rules,
            context: focus.context?.summary ?? null,
            lastDiscovery: focus.lastDiscoveryAt ? local(focus.lastDiscoveryAt) : null,
          },
        }
      : {}),
    projects: active.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      ...(projectPriority(p).level
        ? {
            priority: `${PRIORITY_LABEL[projectPriority(p).level].toLowerCase()} (${projectPriority(p).from === "you" ? "set by the user" : "from Linear"})`,
          }
        : {}),
      ...(p.description ? { description: p.description.slice(0, 300) } : {}),
      rules: Object.fromEntries(Object.entries(p.rules).filter(([, v]) => v.length)),
      ...(p.context ? { context: p.context.summary.slice(0, 500), contextAt: local(p.context.updatedAt) } : {}),
    })),
    ...(unassigned.length ? { unassigned } : {}),
    ...suggestionsDigest(),
    ...dismissedDigest(),
    ...askCheckDigest(),
    ignored: {
      ...(ignoredRepos.length ? { repos: ignoredRepos } : {}),
      ...(projects.some((p) => p.ignored) ? { projects: projects.filter((p) => p.ignored).map((p) => p.name) } : {}),
    },
    // Docs: full text only for docs edited since Claude last ran (the rest are already reflected
    // in their checkbox todos). Older notes are listed by title so get_doc can fetch one if needed.
    ...notesDigest(since),
    brief: day.brief
      ? { summary: day.brief.summary, highlights: day.brief.highlights, at: local(day.brief.generatedAt) }
      : null,
    todos: todos.map(({ t, ids }) => ({
      id: t.id,
      s: t.status,
      p: t.priority,
      title: t.title,
      ...(t.url ? { url: t.url } : {}),
      ...(t.createdBy === "auto" ? { auto: true } : {}),
      ...(t.carriedFrom ? { carried: t.carriedFrom } : {}),
      ...(t.due ? { due: t.due } : {}),
      ...(t.noteId ? { note: t.noteId } : {}),
      ...tag(ids),
    })),
    messages: messages
      .filter(({ m }) => m.status !== "dismissed")
      .map(({ m, ids }) => ({
        id: m.id,
        to: m.to,
        s: m.status,
        ...(m.url ? { url: m.url } : {}),
        text: m.text.slice(0, 160),
        ...tag(ids),
      })),
    items: items.map(({ i, ids }) => ({
      id: i.id,
      state: i.state,
      title: i.title,
      ...(i.project ? { group: i.project } : {}),
      ...(i.waitingOn ? { waitingOn: i.waitingOn } : {}),
      ...(i.status ? { status: i.status } : {}),
      ...tag(ids),
    })),
    github: github.error
      ? { error: github.error }
      : {
          me: github.login,
          fetched: github.fetchedAt && local(github.fetchedAt).slice(11),
          myPrs: myPrs.map(({ p, ids }) => prLine(p) + (pj(ids).length ? ` pj=${pj(ids).join(",")}` : "")),
          reviewRequests: reviewPrs.map(
            ({ p, ids }) => prLine(p, true) + (pj(ids).length ? ` pj=${pj(ids).join(",")}` : ""),
          ),
          botReviewRequests: github.reviewRequests.filter((p) => isBot(p.author)).length,
          ...stacksDigest(),
        },
    // Noticed by code since Claude last ran (GitHub transitions, auto-closed todos).
    changesSinceLastRun: events
      .filter((e) => !since || e.at > since)
      .slice(0, 40)
      .map((e) => `${local(e.at).slice(11)} ${e.text}`),
  };
}

function notesDigest(since?: string) {
  const notes = store.notes();
  if (!notes.length) return {};
  const changed = notes.filter((n) => !since || n.updatedAt > since).slice(0, 6);
  const older = notes.filter((n) => !changed.includes(n)).slice(0, 20);
  return {
    docsChanged: changed.map((n) => ({
      id: n.id,
      title: n.title || "(untitled)",
      kind: n.kind,
      edited: local(n.updatedAt),
      text: n.text.length > 2500 ? `${n.text.slice(0, 2500)}\n…(truncated, get_doc for the rest)` : n.text,
    })),
    ...(older.length
      ? {
          docsOlder: older.map(
            (n) => `${n.id} ${local(n.updatedAt).slice(0, 10)} ${JSON.stringify(n.title || "(untitled)")}`,
          ),
        }
      : {}),
  };
}

export function currentQueue() {
  return buildActions({
    state: {
      sent: store.sentLog(),
      today: store.today().date,
      day: store.today(),
      items: store.items(),
      github,
      projects: store.projects(),
      projectLinks: store.links(),
      settings: store.settings(),
      priorities: store.priorities(),
      snoozes: store.snoozes(),
      dismissed: store.dismissals(),
      reviewAsks: store.reviewAsks(),
      reviewAskLog: store.reviewAskLog(),
    },
  }).open;
}

/** Pending suggestions (don't repeat them) and recently dismissed ones (the user said: not active work). */
function suggestionsDigest() {
  const cutoff = Date.now() - 60 * 86_400_000;
  const all = store.suggestions();
  const pending = all.filter((x) => x.status === "pending").map((x) => x.name);
  const dismissed = all
    .filter((x) => x.status === "dismissed" && new Date(x.decidedAt ?? x.createdAt).getTime() > cutoff)
    .map((x) => x.name);
  return pending.length || dismissed.length
    ? {
        suggestions: {
          ...(pending.length ? { pending } : {}),
          ...(dismissed.length ? { dismissedNotActive: dismissed } : {}),
        },
      }
    : {};
}

/** Stacked PRs as one line each, plus who reviewed part of a stack but not the rest. */
function stacksDigest() {
  const stacks = prStacks(github.mine);
  if (!stacks.length) return {};
  const gaps = stackReviewGaps(github.mine, github.login);
  return {
    stacks: stacks.map((st) => {
      const head = `${st[0].repo.split("/")[1]}#${st.map((p) => p.number).join("→#")}`;
      const partial = gaps
        .filter((g) => g.stack[0].url === st[0].url)
        .map(
          (g) =>
            `${g.login} reviewed ${g.reviewed.map((p) => `#${p.number}`).join(",")} (last ${local(g.lastReviewAt)}), still pending on ${g.left.map((p) => `#${p.number}`).join(",")}`,
        );
      return partial.length ? `${head}; ${partial.join("; ")}` : head;
    }),
  };
}

/** What the user dismissed for good: don't re-add it as a todo, draft or priority. */
function dismissedDigest() {
  const cutoff = Date.now() - 30 * 86_400_000;
  const list = Object.values(store.dismissals())
    .filter((d) => new Date(d.at).getTime() > cutoff)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 25)
    .map((d) => d.title);
  return list.length ? { dismissedByUser: list } : {};
}

/** My open PRs with no known review ask that Claude hasn't looked for in Slack in the last 12h. */
function askCheckDigest() {
  const asks = store.reviewAsks();
  const checked = store.reviewAskChecked();
  const fresh = Date.now() - 12 * 3_600_000;
  const list = github.mine
    .filter((p) => !p.isDraft && !asks[p.url] && !(checked[p.url] && new Date(checked[p.url]).getTime() > fresh))
    .filter((p) => !p.approvedBy.length && !p.changesRequestedBy.length)
    .map((p) => ({ url: p.url, opened: p.createdAt.slice(0, 10) }));
  return list.length ? { prsToCheckForAsks: list } : {};
}
