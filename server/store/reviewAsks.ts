// Review asks: a PR counts as "asked" when its link went to people in Slack, not when GitHub assigned reviewers.
import type { ReviewAsk } from "../../shared/types.ts";
import { now } from "./helpers.ts";
import type { Store } from "./store.ts";

export function reviewAsks(s: Store): Record<string, ReviewAsk> {
  if (!s.data.reviewAsks) {
    // First run: messages already sent with a PR link were asks too.
    s.data.reviewAsks = {};
    for (const d of s.allDays())
      for (const m of d.messages)
        if (m.status === "sent" && m.sentAt)
          for (const pr of prUrlsIn(`${m.url ?? ""} ${m.text}`)) {
            const cur = s.data.reviewAsks[pr];
            if (!cur || cur.at < m.sentAt) s.data.reviewAsks[pr] = { at: m.sentAt, where: m.to, by: "meatdeck" };
          }
  }
  return s.data.reviewAsks;
}
export function reviewAskChecked(s: Store): Record<string, string> {
  return (s.data.reviewAskChecked ??= {});
}
export function reviewAskLog(s: Store) {
  return (s.data.reviewAskLog ??= []);
}
export function recordReviewAsk(s: Store, prUrl: string, ask: ReviewAsk) {
  const url = prUrl.replace(/[#?].*$/, "");
  const cur = s.reviewAsks()[url];
  if (!cur || cur.at < ask.at) s.reviewAsks()[url] = ask;
  const repo = /github\.com\/([^/]+\/[^/]+)\/pull/.exec(url)?.[1];
  if (repo && !s.reviewAskLog().some((x) => x.repo === repo && x.where === ask.where && x.at === ask.at))
    s.data.reviewAskLog = [...s.reviewAskLog(), { repo, where: ask.where, at: ask.at }].slice(-150);
  s.reviewAskChecked()[url] = now();
  s.save();
}
/** Claude looked in Slack for asks on these PRs (found or not), so code knows "not asked" is real. */
export function markReviewAskChecked(s: Store, prUrls: string[]) {
  for (const u of prUrls) s.reviewAskChecked()[u.replace(/[#?].*$/, "")] = now();
  s.save();
}

export function prUrlsIn(text: string): string[] {
  return [...new Set([...text.matchAll(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g)].map((m) => m[0]))];
}
