// The action queue: everything that wants a move, as one ranked list of verbs.
// Pure code (no tokens), shared by the server (Claude's digest) and the UI.
//   1. Collect: my PRs, review requests, drafts, todos, tracked items, note actions.
//   2. Merge duplicates: a todo or draft about a PR becomes part of that PR's action.
//   3. Score: a deterministic baseline (due dates, staleness in work days, review state, CI, P0).
//   4. Override: Claude's judgment (from Slack, Linear, notes) wins where it gave one.
// Tier is what the UI groups by: now / today / watch. "ball" says whose move it is; it does
// NOT decide order, so an urgent nudge to someone else can sit at the top.
import {
  hiddenBy,
  itemEntity,
  itemRepo,
  matchProjects,
  prEntity,
  priorityBoost,
  ticketKeys,
  topPriority,
} from "./projects.ts";
import { isBot, type DashboardState, type GithubPr, type Todo } from "./types.ts";
import { dueBoost, TIER_FLOOR, tierOf, workDaysSince } from "./actionRanking.ts";
import { agoShort, people, shortPrTitle } from "./actionText.ts";
import { agentPromptFor, t3LinkFor } from "./agentPrompts.ts";
import { prStacks, stackReviewGaps } from "./prStacks.ts";

export type Verb =
  | "merge"
  | "send"
  | "address"
  | "fix"
  | "rebase"
  | "review"
  | "reply"
  | "nudge"
  | "wait"
  | "do"
  | "decide"
  | "ask";
export type Tier = "now" | "today" | "watch";
export type PrStep = "conflicts" | "ci" | "changes" | "threads";

export interface Action {
  key: string;
  /** Marked done from the row (a done dismissal): reopening restores it rather than reopening a todo. */
  markedDone?: boolean;
  verb: Verb;
  title: string;
  /** One line: why this, why now. Claude's reason when it re-prioritized. */
  why: string;
  ball: "me" | "them";
  tier: Tier;
  score: number;
  /** Who set the priority: Claude's judgment or the code baseline. */
  by: "claude" | "code";
  source: "github" | "slack" | "linear" | "note" | "manual" | "other";
  url?: string;
  repo?: string;
  projectIds: string[];
  /** Strongest priority among its projects (1 urgent … 4 low; 0/absent = none). Already in `score`. */
  priority?: number;
  due?: string;
  /** Linked records, so buttons know what to act on. */
  todoId?: string;
  messageId?: string;
  itemId?: string;
  noteId?: string;
  pr?: { url: string; number: number; repo: string; author: string; title: string };
  /** For work only an agent can do (fix CI, address review…): a ready-to-paste prompt for T3 Code / Claude Code. */
  agentPrompt?: string;
  /** PR waiting rows timed from a real review ask (so the sent-log pass leaves them alone). */
  askedVia?: boolean;
  /** My PR's blockers, in the order to work them (conflicts first: they change what CI runs against). */
  steps?: PrStep[];
  /** Opens T3 Code on this work: a new thread (PR checked out in a worktree when it's mine) with agentPrompt in the composer. */
  t3Link?: string;
  /** For "wait": when it becomes a nudge. */
  nudgeIn?: string;
  updatedAt: string;
}

export interface PriorityOverride {
  tier: Tier;
  why: string;
  /** The step Claude judged ("fix", "nudge"…). When the row's step changes, the judgment no longer applies. */
  verb?: Verb;
  /** Optional fine ordering inside the tier, 0-100. */
  score?: number;
  at: string;
}

const failing = (c: GithubPr["checks"]) => c === "FAILURE" || c === "ERROR";

export interface ActionInput {
  state: Pick<DashboardState, "today" | "day" | "items" | "github" | "projects" | "projectLinks" | "settings"> & {
    priorities?: Record<string, PriorityOverride>;
    snoozes?: Record<string, string>;
    sent?: DashboardState["sent"];
    dismissed?: DashboardState["dismissed"];
    reviewAsks?: DashboardState["reviewAsks"];
    reviewAskLog?: DashboardState["reviewAskLog"];
  };
  now?: Date;
}

export function buildActions({ state, now = new Date() }: ActionInput): { open: Action[]; done: Action[] } {
  const workDays = state.settings.morning.days;
  const today = state.today;
  const projects = state.projects;
  const links = state.projectLinks;
  const out: Action[] = [];
  const byUrl = new Map<string, Action>();
  const todos = state.day.todos;
  const drafts = state.day.messages.filter((m) => m.status === "draft" || m.status === "approved");

  const push = (a: Omit<Action, "tier" | "by"> & { tier?: Tier }) => {
    const action = { ...a, tier: a.tier ?? tierOf(a.score), by: "code" as const };
    out.push(action);
    if (action.url) byUrl.set(action.url, action);
    return action;
  };

  // ---- my PRs: the verb is the PR's next step ----
  // Titles lead with the verb and a short human version of the PR title; the "core#123" ref
  // is shown separately as a chip (Action.pr), so you can still say "merge 26037".
  // A stack is asked about as one: an ask or a review on any of its PRs covers the rest.
  const stackAsk = new Map<string, NonNullable<ActionInput["state"]["reviewAsks"]>[string]>();
  const stackReviewed = new Set<string>();
  for (const stack of prStacks(state.github.mine)) {
    const asks = stack.map((p) => state.reviewAsks?.[p.url]).filter(Boolean) as NonNullable<
      ActionInput["state"]["reviewAsks"]
    >[string][];
    const latest = asks.sort((x, y) => x.at.localeCompare(y.at)).pop();
    const anyReviewed = stack.some((p) => p.approvedBy.length || p.changesRequestedBy.length);
    for (const p of stack) {
      if (latest) stackAsk.set(p.url, latest);
      if (anyReviewed) stackReviewed.add(p.url);
    }
  }
  const prByUrl = new Map<string, GithubPr>();
  for (const pr of state.github.mine) {
    prByUrl.set(pr.url, pr);
    const t = shortPrTitle(pr.title);
    const base = {
      key: `pr:${pr.url}`,
      source: "github" as const,
      url: pr.url,
      repo: pr.repo,
      projectIds: matchProjects(prEntity(pr), projects, links),
      pr: { url: pr.url, number: pr.number, repo: pr.repo, author: pr.author, title: pr.title },
      updatedAt: pr.updatedAt,
    };
    const ready =
      pr.reviewDecision === "APPROVED" &&
      !failing(pr.checks) &&
      pr.checks !== "PENDING" &&
      pr.mergeable !== "CONFLICTING" &&
      !pr.isDraft;
    // Everything blocking my PR goes on one row, in the order to do it: conflicts first (CI runs
    // against the merge with the base branch, so a rebase can change or fix the failures), then CI,
    // then requested changes, then open threads.
    const steps: PrStep[] = [];
    if (pr.mergeable === "CONFLICTING") steps.push("conflicts");
    if (failing(pr.checks)) steps.push("ci");
    if (pr.changesRequestedBy.length) steps.push("changes");
    if (pr.unresolvedThreads > 0 && (steps.length || !ready)) steps.push("threads");
    if (steps.length && (steps.length > 1 || steps[0] !== "threads")) {
      const SCORE: Record<PrStep, number> = { conflicts: 58, ci: 62, changes: 75, threads: 60 };
      const label: Record<PrStep, string> = {
        conflicts: "resolve conflicts",
        ci: "fix CI",
        changes: `address ${people(pr.changesRequestedBy)}'s review`,
        threads: `resolve ${pr.unresolvedThreads} open thread${pr.unresolvedThreads === 1 ? "" : "s"}`,
      };
      const words = steps.map((s) => label[s]);
      const joined =
        words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")}, then ${words[words.length - 1]}`;
      const why = steps.map((s) =>
        s === "conflicts"
          ? steps.includes("ci")
            ? "Conflicts with the base branch (may be what's breaking CI)"
            : "Conflicts with the base branch"
          : s === "ci"
            ? pr.failingChecks?.length
              ? `Failing: ${people(pr.failingChecks)}`
              : "Checks failing"
            : s === "changes"
              ? "Changes requested"
              : `${pr.unresolvedThreads} open thread${pr.unresolvedThreads === 1 ? "" : "s"}`,
      );
      push({
        ...base,
        verb: steps[0] === "conflicts" ? "rebase" : steps[0] === "ci" ? "fix" : "address",
        ball: "me",
        // As urgent as its most urgent blocker, a little more for each extra one.
        score: Math.max(...steps.map((s) => SCORE[s])) + 2 * (steps.length - 1),
        title: `${joined.charAt(0).toUpperCase()}${joined.slice(1)}: ${t}`,
        why: why.join(" · "),
        steps,
      });
    } else if (ready && pr.unresolvedThreads === 0)
      push({
        ...base,
        verb: "merge",
        ball: "me",
        score: 72,
        title: `Merge: ${t}`,
        why: `Approved by ${people(pr.approvedBy)}, checks green`,
      });
    else if (pr.unresolvedThreads > 0)
      push({
        ...base,
        verb: "address",
        ball: "me",
        score: 60,
        title: `Resolve ${pr.unresolvedThreads} open thread${pr.unresolvedThreads === 1 ? "" : "s"}: ${t}`,
        why: pr.approvedBy.length
          ? `Approved by ${people(pr.approvedBy)}; threads still open`
          : "Review threads still open",
      });
    else if (pr.isDraft) continue; // a draft PR is in progress: nothing to do yet
    else if (pr.pendingReviewers.length || pr.reviewDecision === "REVIEW_REQUIRED") {
      // "Asked for review" means you sent its link to people (Slack, or a MeatDeck message), not that
      // GitHub assigned reviewers (CODEOWNERS does that on its own). No ask yet → asking is the step.
      const ask = state.reviewAsks?.[pr.url] ?? stackAsk.get(pr.url);
      const reviewed = pr.approvedBy.length > 0 || pr.changesRequestedBy.length > 0 || stackReviewed.has(pr.url); // someone's on it, so it was asked somehow
      if (!ask && !reviewed) {
        const age = workDaysSince(pr.createdAt, workDays, now);
        const places = askPlaces(pr.repo, state.reviewAskLog ?? []);
        push({
          ...base,
          verb: "ask",
          ball: "me",
          score: Math.min(66, 50 + Math.round(age * 4)),
          title: `Ask for review: ${t}`,
          why: [
            `Opened ${age < 1 ? "today" : `${age.toFixed(0)} work day${age >= 1.5 ? "s" : ""} ago`}, not shared in Slack yet`,
            places.length ? `you usually ask in ${places.slice(0, 2).join(" or ")}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        });
        continue;
      }
      // The clock runs from your last ask or nudge, and the nudge goes where you asked.
      const lastNudge = state.sent?.[pr.url]?.at;
      const since = [ask?.at, lastNudge].filter(Boolean).sort().pop() ?? pr.updatedAt;
      const who = ask?.where ?? people(pr.pendingReviewers);
      const stale = workDaysSince(since, workDays, now);
      const when = ask
        ? `You asked in ${ask.where} ${agoShort(since, now)} ago`
        : `Review activity ${agoShort(since, now)} ago`;
      if (stale >= 1)
        push({
          ...base,
          verb: "nudge",
          ball: "them",
          score: Math.min(68, 42 + Math.round(stale * 6)),
          title: `Nudge ${who} to review: ${t}`,
          why: `${when}; no review since`,
          askedVia: !!ask,
        });
      else
        push({
          ...base,
          verb: "wait",
          ball: "them",
          score: 15,
          title: `Waiting on ${who}: ${t}`,
          why: when,
          nudgeIn: `${Math.max(1, Math.ceil((1 - stale) * 24))}h`,
          askedVia: !!ask,
        });
    }
  }

  // ---- review requests on me ----
  for (const pr of state.github.reviewRequests) {
    if (isBot(pr.author)) continue;
    prByUrl.set(pr.url, pr);
    const waited = workDaysSince(pr.createdAt, workDays, now);
    push({
      key: `review:${pr.url}`,
      verb: "review",
      ball: "me",
      score: Math.min(69, 48 + Math.round(waited * 7)),
      title: `Review for ${pr.author}: ${shortPrTitle(pr.title)}`,
      why: `Waiting ${waited < 1 ? `${Math.max(1, Math.round(waited * 24))}h` : `${waited.toFixed(0)}d`} for your review`,
      source: "github",
      url: pr.url,
      repo: pr.repo,
      projectIds: matchProjects(prEntity(pr), projects, links),
      pr: { url: pr.url, number: pr.number, repo: pr.repo, author: pr.author, title: pr.title },
      updatedAt: pr.updatedAt,
    });
  }

  // ---- stacks: a reviewer who reviewed part of my stack but not the rest ----
  // One PR row can only say one thing, and my own step (fix CI, threads) wins it, so "Alex approved
  // 1 of 4 and the other 3 still wait on him" would never show. This row says it, per reviewer.
  const stackNudged = new Map<string, { at: string; to: string }>(); // PR url → a stack nudge that covered it
  for (const gap of stackReviewGaps(state.github.mine, state.github.login)) {
    const root = gap.stack[0];
    const nudged = state.sent?.[`${gap.left[0].url}#stack-review-${gap.login}`];
    if (nudged)
      for (const p of gap.left)
        if (!stackNudged.has(p.url) || stackNudged.get(p.url)!.at < nudged.at) stackNudged.set(p.url, nudged);
    const stale = workDaysSince(gap.lastReviewAt, workDays, now);
    const reviewedRefs = gap.reviewed.map((p) => `#${p.number}`).join(", ");
    const leftRefs = gap.left.map((p) => `#${p.number}`).join(", ");
    push({
      key: `stack:${root.url}:${gap.login}`,
      verb: stale >= 1 ? "nudge" : "wait",
      ball: "them",
      // A person who already started the stack is the cheapest reviewer to finish it.
      score: stale >= 1 ? Math.min(72, 56 + Math.round(stale * 6)) : 30,
      title: `${stale >= 1 ? "Nudge" : "Waiting on"} ${gap.login} to finish the stack (${gap.reviewed.length} of ${gap.stack.length} reviewed): ${shortPrTitle(root.title)}`,
      why: `Reviewed ${reviewedRefs}${stale >= 0.1 ? ` ${stale < 1 ? "today" : `${stale.toFixed(0)} work day${stale >= 1.5 ? "s" : ""} ago`}` : ""}; still pending on ${leftRefs}`,
      source: "github",
      // Own url (a fragment GitHub ignores) so the PR rows' todos don't fold into it, but a draft
      // with this exact url becomes its "send" step.
      url: `${gap.left[0].url}#stack-review-${gap.login}`,
      repo: root.repo,
      projectIds: [...new Set(gap.stack.flatMap((p) => matchProjects(prEntity(p), projects, links)))],
      pr: { url: gap.left[0].url, number: gap.left[0].number, repo: root.repo, author: root.author, title: root.title },
      nudgeIn: stale < 1 ? `${Math.max(1, Math.ceil((1 - stale) * 24))}h` : undefined,
      updatedAt: gap.lastReviewAt,
    });
  }

  // ---- tracked items (Linear, Slack) not already covered by a PR ----
  const itemOf = (id?: string) => state.items.find((i) => i.id === id);
  for (const item of state.items) {
    if (item.state === "done" || (item.url && byUrl.has(item.url))) continue;
    // A ticket whose PR is already in the queue is part of that PR's row (ENG-142 ↔ "[ENG-142]" in the title).
    const keys = ticketKeys(`${item.id} ${item.title}`);
    const prRow = keys.length
      ? out.find((a) => a.pr && keys.some((k) => `${a.title} ${a.why} ${a.pr?.title ?? ""}`.includes(k)))
      : undefined;
    if (prRow) {
      prRow.itemId ??= item.id;
      continue;
    }
    const mine = item.state === "needs_me";
    const blocked = item.state === "blocked";
    const stale = workDaysSince(item.updatedAt, workDays, now);
    if (!mine && !blocked && item.state !== "waiting") continue; // in progress: not an action
    const verb: Verb = mine ? (item.source === "slack" ? "reply" : "do") : stale >= 1 ? "nudge" : "wait";
    push({
      key: `item:${item.id}`,
      verb,
      ball: mine ? "me" : "them",
      // A Slack ask waiting on you outranks an assigned ticket with no concrete next step.
      score: mine
        ? item.source === "slack"
          ? 58
          : 44
        : verb === "nudge"
          ? Math.min(66, 40 + Math.round(stale * 5)) + (blocked ? 8 : 0)
          : 12,
      title: mine
        ? item.title
        : verb === "nudge"
          ? `Nudge ${item.waitingOn ?? "them"}: ${item.title}`
          : `Waiting on ${item.waitingOn ?? "others"}: ${item.title}`,
      why: [item.status, item.note].filter(Boolean).join(" · "),
      source: item.source === "slack" || item.source === "linear" ? item.source : "other",
      url: item.url,
      repo: itemRepo(item),
      projectIds: matchProjects(itemEntity(item), projects, links),
      itemId: item.id,
      nudgeIn: verb === "wait" ? `${Math.max(1, Math.ceil((1 - stale) * 24))}h` : undefined,
      updatedAt: item.updatedAt,
    });
  }

  // ---- drafts: a draft about something already listed becomes its "send" step ----
  for (const m of drafts) {
    const target = m.url ? byUrl.get(m.url) : undefined;
    if (target) {
      target.verb = "send";
      target.messageId = m.id;
      target.ball = "me";
      target.title = `Send to ${m.to}: ${target.title.replace(/^(Nudge|Waiting on) [^:]+?:\s*/, "")}`;
      target.why = m.reason;
      target.score = Math.max(target.score, 60);
      continue;
    }
    push({
      key: `msg:${m.id}`,
      verb: "send",
      ball: "me",
      score: 60,
      title: `Send to ${m.to}`,
      why: m.reason,
      source: m.channel === "slack" || m.channel === "github" || m.channel === "linear" ? m.channel : "other",
      url: m.url,
      projectIds: [],
      messageId: m.id,
      updatedAt: m.createdAt,
    });
  }

  // ---- you already sent it: the ball is in their court ----
  // A nudge or reply that went out turns its row into "waiting on them" (Watching), and it comes back
  // as a nudge only after a full work day with no movement. Plain code from the sent log: no tokens.
  const sent = state.sent ?? {};
  for (let i = out.length - 1; i >= 0; i--) {
    const a = out[i];
    // A PR nudge that a sent stack nudge already covered: the stack row speaks for it.
    if (
      (a.verb === "nudge" || a.verb === "wait") &&
      a.key.startsWith("pr:") &&
      a.url &&
      !sent[a.url] &&
      stackNudged.has(a.url)
    ) {
      out.splice(i, 1);
      continue;
    }
  }
  for (const a of out) {
    const s = a.url ? sent[a.url] : undefined;
    if (!s || a.verb === "send" || a.askedVia) continue;
    const item = a.itemId ? state.items.find((i) => i.id === a.itemId) : undefined;
    // Something happened after you sent it (they replied, the item changed): the row is current again.
    if (item && new Date(item.updatedAt).getTime() > new Date(s.at).getTime() + 60_000) continue;
    const isNudge = a.verb === "nudge" || a.verb === "wait";
    const isReply = a.verb === "reply" || (a.verb === "do" && !!item && a.source !== "github");
    if (!isNudge && !isReply) continue; // e.g. a PR still needs a fix even if you messaged about it
    const since = workDaysSince(s.at, workDays, now);
    const ago = agoShort(s.at, now);
    const who = s.to;
    // "Nudge alextgrd to finish the stack (1 of 4): X" keeps its "to finish…"; others keep what follows the colon.
    const toPhrase = /^(?:Nudge|Waiting on) \S+ (to [^:]+):\s*(.*)$/.exec(a.title);
    const rest = toPhrase ? `${toPhrase[1]}: ${toPhrase[2]}` : a.title.replace(/^(Nudge|Waiting on) [^:]+?:\s*/, "");
    const sep = toPhrase ? " " : ": ";
    a.ball = "them";
    if (since >= 1) {
      a.verb = "nudge";
      a.score = Math.min(64, 44 + Math.round((since - 1) * 6));
      a.title = `Nudge ${who} again${sep}${rest}`;
      a.why = `You ${isReply ? "replied" : "nudged"} ${ago} ago; no movement since`;
    } else {
      a.verb = "wait";
      a.score = 14;
      a.title = `Waiting on ${who}${sep}${rest}`;
      a.why = `You ${isReply ? "replied" : "nudged"} ${ago} ago`;
      a.nudgeIn = `${Math.max(1, Math.ceil((1 - since) * 24))}h`;
    }
  }

  // ---- todos: absorbed into a matching action, or their own "do" step ----
  const doneActions: Action[] = [];
  for (const t of todos) {
    const target = t.url ? byUrl.get(t.url) : t.itemId ? out.find((a) => a.itemId === t.itemId) : undefined;
    if (t.status !== "open") {
      if (t.status === "done") doneActions.push(todoAction(t, today, state, links)); // skipped ones aren't "done"
      continue;
    }
    if (target) {
      target.todoId ??= t.id;
      target.due ??= t.due;
      target.score = Math.max(target.score, t.priority === "p0" ? 80 : target.score) + dueBoost(t.due, today);
      if (t.notes && target.verb !== "send") target.why = t.notes;
      continue;
    }
    out.push(todoAction(t, today, state, links));
  }

  // ---- a ticket that a todo already covers ("Take app#1556 (ENG-157) out of draft") folds into it ----
  for (let i = out.length - 1; i >= 0; i--) {
    const a = out[i];
    if (!a.key.startsWith("item:")) continue;
    const keys = ticketKeys(`${a.itemId} ${a.title}`);
    const owner = keys.length
      ? out.find((b) => b !== a && b.todoId && keys.some((k) => `${b.title} ${b.why} ${b.pr?.title ?? ""}`.includes(k)))
      : undefined;
    if (owner) {
      owner.itemId ??= a.itemId;
      owner.projectIds = [...new Set([...owner.projectIds, ...a.projectIds])];
      out.splice(i, 1);
    }
  }

  // ---- prompts for work only a coding agent can do (plain text from data we have: no tokens) ----
  for (const a of out)
    if (a.pr) {
      a.agentPrompt = agentPromptFor(a, prByUrl.get(a.pr.url));
      if (a.agentPrompt) a.t3Link = t3LinkFor(a, a.agentPrompt);
    }

  // ---- Claude's judgment, snoozes, hidden repos/projects ----
  const priorities = state.priorities ?? {};
  const snoozes = state.snoozes ?? {};
  const dismissed = state.dismissed ?? {};
  // A dismissal covers the step you dismissed; GitHub rows can move to a new step (fix → merge) that shows again.
  const isDismissed = (a: Action) => {
    const d = dismissed[a.key];
    return !!d && (!a.pr || d.verb === a.verb);
  };
  // Rows you ticked (✓) today show under "Done today"; older ones just stay hidden like a dismissal.
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  for (const a of out) {
    const d = dismissed[a.key];
    if (!d?.done || !isDismissed(a) || dayOf(d.at) !== today) continue;
    if (a.todoId && doneActions.some((x) => x.todoId === a.todoId)) continue;
    doneActions.push({ ...a, markedDone: true });
  }
  const visible = out.filter(
    (a) =>
      !isDismissed(a) &&
      !(snoozes[a.key] && snoozes[a.key] > today) &&
      !hiddenBy(a.repo, a.projectIds, projects, state.settings.ignoredRepos),
  );
  for (const a of visible) {
    // Project priority (yours, else Linear's) moves the code ranking; Claude's overrides below win.
    const top = topPriority(a.projectIds, projects);
    if (top.level) {
      a.priority = top.level;
      a.score = Math.max(1, a.score + priorityBoost(top.level));
    }
    a.score = Math.min(100, a.score);
    const o = priorities[a.key];
    // Judgments saved before they recorded their step (no verb) can't tell the row moved on: skip them.
    if (o && o.verb === a.verb) {
      a.by = "claude";
      a.tier = o.tier;
      a.why = o.why || a.why;
      a.score =
        o.score ??
        Math.max(TIER_FLOOR[o.tier], Math.min(a.score, o.tier === "now" ? 100 : o.tier === "today" ? 69 : 39));
    } else a.tier = tierOf(a.score);
  }
  visible.sort((x, y) => y.score - x.score || x.updatedAt.localeCompare(y.updatedAt));
  return { open: visible, done: doneActions };

  function todoAction(t: Todo, todayStr: string, s: ActionInput["state"], l: Record<string, string[]>): Action {
    const item = itemOf(t.itemId);
    return {
      key: `todo:${t.id}`,
      verb: "do",
      ball: "me",
      tier: "today",
      by: "code",
      score: (t.priority === "p0" ? 74 : t.priority === "p1" ? 48 : 22) + dueBoost(t.due, todayStr),
      title: t.title,
      why: t.notes ?? "",
      source: t.noteId
        ? "note"
        : t.source === "github" || t.source === "slack" || t.source === "linear"
          ? t.source
          : "manual",
      url: t.url,
      projectIds: matchProjects(
        { key: `todo:${t.id}`, title: t.title, text: t.notes, repo: undefined },
        s.projects,
        l,
      ).concat(item ? matchProjects(itemEntity(item), s.projects, l) : []),
      due: t.due,
      todoId: t.id,
      noteId: t.noteId,
      updatedAt: t.createdAt,
    };
  }
}

/** Where you've asked for reviews on this repo before, most used first ("#code-reviews"). */
function askPlaces(repo: string, log: { repo: string; where: string }[]): string[] {
  const n = new Map<string, number>();
  for (const x of log) if (x.repo === repo) n.set(x.where, (n.get(x.where) ?? 0) + 1);
  return [...n.entries()].sort((x, y) => y[1] - x[1]).map(([w]) => w);
}
