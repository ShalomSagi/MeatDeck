// Prompts for work only a coding agent can do (fix CI, address review, resolve conflicts, review),
// built as plain text from data we already have (no tokens), plus T3 Code's link that opens them.
import type { GithubPr } from "./types.ts";
import type { Action, PrStep } from "./actions.ts";
import { people } from "./actionText.ts";

export function agentPromptFor(a: Action, pr: GithubPr | undefined): string | undefined {
  if (!a.pr) return undefined;
  const { url, number, repo } = a.pr;
  const name = `${repo}#${number} "${a.pr.title}"`;
  const done = a.todoId
    ? `\n\nWhen it's done, mark the MeatDeck todo done (meatdeck MCP: update_todo id "${a.todoId}" status "done").`
    : "";
  if (a.steps && a.steps.length > 1) {
    const reviewers =
      people(pr?.changesRequestedBy.length ? pr.changesRequestedBy : (pr?.approvedBy ?? [])) || "the reviewers";
    const part: Record<PrStep, string> = {
      conflicts: `Resolve the merge conflicts: rebase onto (or merge) the latest base branch and resolve each conflict, keeping both sides' intent. Run the build and tests, then push (force-with-lease if you rebased). Wait for CI on the new head before judging the failures below: the rebase may have fixed or changed them.`,
      ci: `Fix the failing CI${pr?.failingChecks?.length ? ` (${pr.failingChecks.join(", ")})` : ""}: gh pr checks ${url}, then the logs (gh run view <id> --log-failed for GitHub Actions; the Buildkite build page/logs for Buildkite checks). Fix the root cause; don't skip, disable or weaken checks. If a check is flaky or unrelated, say so instead of changing it.`,
      changes: `Address the requested changes: read every review comment (gh pr view ${url} --comments, and gh api repos/${repo}/pulls/${number}/comments for inline ones), make the changes or reply with a short reason where you disagree.`,
      threads: `Resolve the open review threads: make each change or reply with a reason, keeping each change scoped to its comment.`,
    };
    return `Get ${name} unblocked: ${url}
Work these in order:
0. gh pr checkout ${number} -R ${repo}
${a.steps.map((s, i) => `${i + 1}. ${part[s]}`).join("\n")}
${a.steps.length + 1}. Push, confirm the checks go green${a.steps.some((s) => s === "changes" || s === "threads") ? `, reply on each thread saying what changed, and re-request review from ${reviewers}` : ""}.${done}`;
  }
  switch (a.verb) {
    case "fix":
      return `Fix the failing CI on ${name}: ${url}
Failing checks: ${pr?.failingChecks?.join(", ") || "see gh pr checks"}.
1. Check out the branch: gh pr checkout ${number} -R ${repo}
2. Read why each failing check fails: gh pr checks ${url}, then the logs (gh run view <id> --log-failed for GitHub Actions; the Buildkite build page/logs for Buildkite checks).
3. Fix the root cause in the code or config. Don't skip, disable or weaken checks; if a check is flaky or unrelated, say so instead of changing it.
4. Run the relevant tests locally, commit, push, and confirm the checks go green.${done}`;
    case "address":
      return `Address the open review feedback on ${name}: ${url}
1. gh pr checkout ${number} -R ${repo}
2. Read every unresolved review thread and comment (gh pr view ${url} --comments, and gh api repos/${repo}/pulls/${number}/comments for inline ones).
3. Make the requested changes, or reply with a short reason where you disagree. Keep each change scoped to its comment.
4. Push, reply on each thread saying what changed, and re-request review from ${people(pr?.changesRequestedBy.length ? pr.changesRequestedBy : (pr?.approvedBy ?? [])) || "the reviewers"}.${done}`;
    case "rebase":
      return `Resolve the merge conflicts on ${name}: ${url}
1. gh pr checkout ${number} -R ${repo}
2. Rebase onto (or merge) the latest base branch and resolve each conflict, keeping both sides' intent.
3. Run the build and tests, then push (force-with-lease if you rebased).${done}`;
    case "review":
      return `/review-pr ${url}${done}`;
    case "decide":
      return `Pick and request the right reviewers for ${name}: ${url} (use the pr-reviewer-selection skill if you have it: CODEOWNERS plus who recently touched these files), then request them with gh pr edit ${url} --add-reviewer <logins>.${done}`;
    default:
      return undefined;
  }
}

/**
 * T3 Code's prompt link (t3code://new). `pr=` checks the PR out into a new worktree first, which is
 * what fixing my own PR needs; reviews and reviewer picks only need the repo. T3 fills the composer
 * and never auto-sends (by design), so you read the prompt and press Enter.
 */
export function t3LinkFor(a: Action, prompt: string): string | undefined {
  if (!a.pr || prompt.length > 8000) return undefined;
  const q = new URLSearchParams({ prompt });
  if (a.verb === "fix" || a.verb === "address" || a.verb === "rebase") q.set("pr", a.pr.url);
  else q.set("repo", a.pr.repo);
  return `t3code://new?${q.toString().replace(/\+/g, "%20")}`;
}
