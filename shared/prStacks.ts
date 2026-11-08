// Stacked PRs: my open PRs grouped by base/head branch, and reviewers who reviewed part of a
// stack but are still requested on the rest.
import { isBot, type GithubPr } from "./types.ts";

/** My open PRs grouped into stacks (a PR whose base branch is another PR's head), bottom first. Only stacks of 2+. */
export function prStacks(mine: GithubPr[]): GithubPr[][] {
  const byHead = new Map(mine.filter((p) => p.headRef).map((p) => [`${p.repo}:${p.headRef}`, p]));
  const parent = (p: GithubPr) => (p.baseRef ? byHead.get(`${p.repo}:${p.baseRef}`) : undefined);
  const children = new Map<string, GithubPr[]>();
  for (const p of mine) {
    const up = parent(p);
    if (up) children.set(up.url, [...(children.get(up.url) ?? []), p]);
  }
  const stacks: GithubPr[][] = [];
  for (const root of mine.filter((p) => !parent(p) && children.has(p.url))) {
    const stack: GithubPr[] = [];
    const walk = (p: GithubPr) => {
      stack.push(p);
      for (const c of (children.get(p.url) ?? []).sort((a, b) => a.number - b.number)) walk(c);
    };
    walk(root);
    stacks.push(stack);
  }
  return stacks;
}

export interface StackReviewGap {
  login: string;
  stack: GithubPr[];
  reviewed: GithubPr[];
  left: GithubPr[];
  lastReviewAt: string;
}

/** Reviewers who reviewed at least one PR of a stack and are still requested on others in it. */
export function stackReviewGaps(mine: GithubPr[], me?: string): StackReviewGap[] {
  const gaps: StackReviewGap[] = [];
  for (const stack of prStacks(mine.filter((p) => !p.isDraft))) {
    const logins = new Set(stack.flatMap((p) => (p.reviews ?? []).map((r) => r.login)));
    for (const login of logins) {
      if (login === me || isBot(login)) continue;
      const reviewed = stack.filter((p) => p.reviews?.some((r) => r.login === login));
      const left = stack.filter((p) => !reviewed.includes(p) && p.pendingReviewers.includes(login));
      if (!left.length) continue;
      const lastReviewAt = stack
        .flatMap((p) => (p.reviews ?? []).filter((r) => r.login === login).map((r) => r.at))
        .sort()
        .at(-1)!;
      gaps.push({ login, stack, reviewed, left, lastReviewAt });
    }
  }
  return gaps;
}
