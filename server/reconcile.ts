// Deterministic GitHub bookkeeping: zero tokens.
// After every `gh` poll, diff against the last seen state and act on transitions:
// close todos/items/drafts for merged PRs, add todos for new review requests,
// red CI, requested changes, conflicts, and ready-to-merge. Everything noticed
// is logged as a ChangeEvent that Claude gets handed for free on its next run.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoIgnored } from "../shared/projects.ts";
import { isBot, type ChangeEvent, type GithubPr, type GithubSnapshot, type Todo } from "../shared/types.ts";
import { refreshGithub } from "./github.ts";
import { enabledIn, runAction } from "./integrations.ts";
import { resolveBin } from "./shellEnv.ts";
import type { GhSeen } from "./store/persistence.ts";
import { store } from "./store/store.ts";

const run = promisify(execFile);
const ref = (s: { repo: string; number: number }) => `${s.repo.split("/")[1]}#${s.number}`;
const failing = (c: GithubPr["checks"]) => c === "FAILURE" || c === "ERROR";

function seenOf(pr: GithubPr, role: GhSeen["role"]): GhSeen {
  return {
    role,
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    checks: pr.checks,
    reviewDecision: pr.reviewDecision,
    mergeable: pr.mergeable,
    approvedBy: pr.approvedBy,
    changesRequestedBy: pr.changesRequestedBy,
    unresolvedThreads: pr.unresolvedThreads,
  };
}

async function finalState(url: string): Promise<"MERGED" | "CLOSED" | "OPEN" | undefined> {
  try {
    const { stdout } = await run(resolveBin("gh"), ["pr", "view", url, "--json", "state", "-q", ".state"], {
      timeout: 20_000,
    });
    return stdout.trim() as "MERGED" | "CLOSED" | "OPEN";
  } catch {
    return undefined;
  }
}

/** Refresh from GitHub and reconcile. The only entry point other code should use. */
export async function syncGithub() {
  const gh = await refreshGithub();
  await mergeOtherCodeHosts(gh);
  if (gh.error) return gh;
  await reconcile(
    gh.mine,
    gh.reviewRequests.filter((p) => !isBot(p.author)),
  );
  await settleMentionedPrs(gh);
  return gh;
}

let reconciling = false;
async function reconcile(mine: GithubPr[], reviews: GithubPr[]) {
  if (reconciling) return;
  reconciling = true;
  try {
    const prev = store.ghSeen();
    const next: Record<string, GhSeen> = {};
    for (const pr of mine) next[pr.url] = seenOf(pr, "mine");
    for (const pr of reviews) next[pr.url] = seenOf(pr, "review");

    // First run ever: just remember, don't flood with "new" events.
    if (!prev) return store.setGhSeen(next);

    const at = new Date().toISOString();
    const events: ChangeEvent[] = [];
    const todos: (Partial<Todo> & { title: string })[] = [];
    const say = (text: string, url: string) => events.push({ at, text, url });

    for (const pr of [...mine, ...reviews]) {
      const before = prev[pr.url];
      const now = next[pr.url];
      const r = ref(pr);
      // GitHub answers UNKNOWN / no checks while it recomputes. That's "no news", not a change:
      // keep the last known value so the next real answer isn't mistaken for a fresh transition.
      if (before && now.mergeable === "UNKNOWN") now.mergeable = before.mergeable;
      if (before && now.checks === null) now.checks = before.checks;

      if (now.role === "review") {
        if (!before || before.role !== "review") {
          say(`${pr.author} requested your review on ${r} "${pr.title}"`, pr.url);
          todos.push({
            title: `Review ${r}: ${pr.title} (${pr.author})`,
            url: pr.url,
            source: "github",
            priority: "p1",
          });
        }
        continue;
      }

      // My PR. Skip drafts for review-related nudges, but CI still matters.
      if (!before) continue; // I just opened it, nothing to react to yet.
      if (failing(now.checks) && !failing(before.checks)) {
        say(`CI failed on ${r}`, pr.url);
        todos.push({ title: `Fix CI on ${r}: ${pr.title}`, url: pr.url, source: "github", priority: "p1" });
      }
      if (now.checks === "SUCCESS" && failing(before.checks)) {
        // Green again (or an ignore rule now excludes the failing check): CI todos for this PR are done.
        say(
          `CI is green again on ${r}${pr.ignoredFailures?.length ? ` (ignoring ${pr.ignoredFailures.join(", ")})` : ""}`,
          pr.url,
        );
        store.settleCiTodos(pr.url);
      }
      for (const who of now.approvedBy.filter((x) => !before.approvedBy.includes(x)))
        say(`${who} approved ${r}`, pr.url);
      const newChanges = now.changesRequestedBy.filter((x) => !before.changesRequestedBy.includes(x));
      if (newChanges.length) {
        say(`${newChanges.join(", ")} requested changes on ${r}`, pr.url);
        todos.push({
          title: `Address ${newChanges.join(", ")}'s review on ${r}`,
          url: pr.url,
          source: "github",
          priority: "p0",
        });
      }
      if (now.mergeable === "CONFLICTING" && before.mergeable !== "CONFLICTING") {
        say(`${r} has merge conflicts`, pr.url);
        todos.push({ title: `Resolve conflicts on ${r}`, url: pr.url, source: "github", priority: "p1" });
      }
      if (now.unresolvedThreads > before.unresolvedThreads)
        say(`${now.unresolvedThreads - before.unresolvedThreads} new review thread(s) on ${r}`, pr.url);
      const ready = (s: GhSeen) =>
        s.reviewDecision === "APPROVED" &&
        !failing(s.checks) &&
        s.checks !== "PENDING" &&
        s.mergeable !== "CONFLICTING";
      if (ready(now) && !ready(before)) {
        say(`${r} is approved and ready to merge`, pr.url);
        todos.push({ title: `Merge ${r}: ${pr.title}`, url: pr.url, source: "github", priority: "p1" });
      }
    }

    // PRs that left the lists: merged/closed (mine), or reviewed/withdrawn (review requests).
    const ignored = store.settings().ignoredRepos;
    for (const [url, before] of Object.entries(prev)) {
      if (next[url]) continue;
      // Gone because its repo is ignored now: forget it quietly, no `gh` call, no events.
      if (repoIgnored(before.repo, ignored)) continue;
      const r = ref(before);
      const state = await finalState(url);
      if (state === "MERGED" || state === "CLOSED") {
        say(`${r} was ${state.toLowerCase()}`, url);
        store.settleUrl(url, `auto: ${state.toLowerCase()}`);
      } else if (state === "OPEN" && before.role === "review") {
        say(`Review request on ${r} is no longer pending (reviewed or removed)`, url);
        store.settleUrl(url, "auto: review done");
      } else if (state === "OPEN" && before.role === "mine") {
        // Still open but out of the search window (e.g. >25 PRs): keep remembering it.
        next[url] = before;
      }
    }

    if (todos.length) store.addTodos(todos, "auto");
    store.addEvents(events);
    store.setGhSeen(next);
  } finally {
    reconciling = false;
  }
}

/**
 * Other code-hosting integrations (GitLab via CLI, an API…) contribute PRs through their
 * listMyPullRequests / listReviewRequests actions, which must return JSON in the documented shape.
 */
async function mergeOtherCodeHosts(gh: GithubSnapshot) {
  for (const i of enabledIn("code")) {
    if (i.id === "github") continue;
    for (const [action, into] of [
      ["listMyPullRequests", gh.mine],
      ["listReviewRequests", gh.reviewRequests],
    ] as const) {
      const impl = i.actions[action];
      if (!impl || impl.kind === "none" || impl.kind === "claude") continue; // polling via Claude would burn tokens
      const r = await runAction(i.id, action);
      if (!r.ok || !Array.isArray(r.output)) continue;
      for (const raw of r.output as Partial<GithubPr>[]) {
        if (!raw.url || into.some((p) => p.url === raw.url)) continue;
        into.push({
          id: raw.id ?? raw.url,
          number: raw.number ?? 0,
          title: raw.title ?? raw.url,
          url: raw.url,
          repo: raw.repo ?? new URL(raw.url).pathname.split("/").slice(1, 3).join("/"),
          author: raw.author ?? "",
          isDraft: !!raw.isDraft,
          createdAt: raw.createdAt ?? new Date().toISOString(),
          updatedAt: raw.updatedAt ?? new Date().toISOString(),
          reviewDecision: raw.reviewDecision ?? null,
          checks: raw.checks ?? null,
          mergeable: raw.mergeable ?? "UNKNOWN",
          pendingReviewers: raw.pendingReviewers ?? [],
          approvedBy: raw.approvedBy ?? [],
          changesRequestedBy: raw.changesRequestedBy ?? [],
          unresolvedThreads: raw.unresolvedThreads ?? 0,
        });
      }
    }
  }
}

// ---------- todos and Slack items that are about a PR outside the open lists ----------
// "Nudge Alex about app#1475" stays useful only while app#1475 is open. Code checks the PR
// itself (gh, cached, a few calls per poll) and closes the todo when it's merged or closed. No tokens.

const prStates = new Map<string, { state: "MERGED" | "CLOSED" | "OPEN"; at: number }>();
/** Verbs of todos whose whole point is the PR's progress (not "answer Ben about the copy in core#12"). */
const ABOUT_THE_PR =
  /\b(nudge|ping|chase|follow[\s-]?up|review|merge|fix|rebase|resolve|address|request|re-?request|unblock|land|ship|check|verify|get .+ reviewed|still open)\b/i;

function prRefs(text: string, known: Map<string, string>): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g))
    out.add(`https://github.com/${m[1]}/pull/${m[2]}`);
  for (const m of text.matchAll(/(?<![\w/.-])([\w.-]+(?:\/[\w.-]+)?)#(\d+)\b/g)) {
    const full = m[1].includes("/") ? m[1] : known.get(m[1].toLowerCase());
    if (full) out.add(`https://github.com/${full}/pull/${m[2]}`);
  }
  return [...out];
}

async function stateOf(url: string): Promise<"MERGED" | "CLOSED" | "OPEN" | undefined> {
  const c = prStates.get(url);
  if (c && (c.state !== "OPEN" || Date.now() - c.at < 30 * 60_000)) return c.state;
  const s = await finalState(url);
  if (s) prStates.set(url, { state: s, at: Date.now() });
  return s;
}

async function settleMentionedPrs(gh: GithubSnapshot) {
  const open = new Set([...gh.mine, ...gh.reviewRequests].map((p) => p.url));
  // "app#1475" → acme/app, from repos we've seen.
  const known = new Map<string, string>();
  for (const p of [...gh.mine, ...gh.reviewRequests]) known.set(p.repo.split("/")[1].toLowerCase(), p.repo);
  for (const s of Object.values(store.ghSeen() ?? {})) known.set(s.repo.split("/")[1].toLowerCase(), s.repo);

  const day = store.today();
  const candidates: { kind: "todo" | "item"; id: string; prs: string[] }[] = [];
  for (const t of day.todos) {
    if (t.status !== "open" || !ABOUT_THE_PR.test(t.title)) continue;
    const prs = prRefs(`${t.title} ${t.url ?? ""}`, known).filter((u) => !open.has(u));
    if (prs.length) candidates.push({ kind: "todo", id: t.id, prs });
  }
  for (const i of store.items()) {
    if (i.state === "done" || i.source !== "slack") continue;
    const prs = prRefs(`${i.title} ${i.status ?? ""} ${i.url ?? ""}`, known).filter((u) => !open.has(u));
    if (prs.length) candidates.push({ kind: "item", id: i.id, prs });
  }

  let calls = 0;
  for (const c of candidates) {
    const states: string[] = [];
    for (const url of c.prs) {
      if (!prStates.has(url) && calls >= 8) break; // spread lookups over polls
      if (!prStates.has(url)) calls++;
      states.push((await stateOf(url)) ?? "?");
    }
    if (states.length !== c.prs.length || !states.every((s) => s === "MERGED" || s === "CLOSED")) continue;
    const what = c.prs
      .map((u, k) => `${u.replace(/^https:\/\/github\.com\/[^/]+\/([^/]+)\/pull\//, "$1#")} ${states[k].toLowerCase()}`)
      .join(", ");
    store.closeAsDone(c.kind, c.id, `auto: ${what}`);
    store.addEvents([
      {
        at: new Date().toISOString(),
        text: `Closed "${c.kind === "todo" ? day.todos.find((t) => t.id === c.id)?.title : c.id}": ${what}`,
      },
    ]);
  }
}
