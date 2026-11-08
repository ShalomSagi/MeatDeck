import type { GithubPr } from "../../shared/types.ts";
import type { BadgeVariant } from "./components/ui.tsx";

export function ago(iso?: string): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (86400 * 30))}mo`;
}

/** "just now" / "5m ago" — for prose; ago() stays bare for compact columns. */
export function agoText(iso?: string): string {
  const a = ago(iso);
  return !a ? "never" : a === "now" ? "just now" : `${a} ago`;
}

export function people(names: string[], max = 2) {
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} +${names.length - max}`;
}

export interface PrSignal {
  label: string;
  variant: BadgeVariant;
  /** Whether the ball is in my court. */
  mine: boolean;
}

/** What a PR I authored needs right now, most urgent first. */
export function prSignals(pr: GithubPr): PrSignal[] {
  const out: PrSignal[] = [];
  if (pr.changesRequestedBy.length)
    out.push({ label: `Changes requested · ${people(pr.changesRequestedBy)}`, variant: "error", mine: true });
  if (pr.checks === "FAILURE" || pr.checks === "ERROR")
    out.push({
      label: pr.failingChecks?.length ? `CI failing: ${people(pr.failingChecks)}` : "CI failing",
      variant: "error",
      mine: true,
    });
  if (pr.ignoredFailures?.length)
    out.push({ label: `Ignored: ${people(pr.ignoredFailures)}`, variant: "default", mine: false });
  if (pr.mergeable === "CONFLICTING") out.push({ label: "Conflicts", variant: "error", mine: true });
  if (pr.unresolvedThreads > 0)
    out.push({ label: `${pr.unresolvedThreads} unresolved`, variant: "warning", mine: true });
  if (pr.isDraft) out.push({ label: "Draft", variant: "default", mine: true });
  else if (pr.reviewDecision === "APPROVED" && pr.checks !== "FAILURE" && pr.mergeable !== "CONFLICTING")
    out.push({ label: "Ready to merge", variant: "success", mine: true });
  else if (pr.pendingReviewers.length)
    out.push({
      label: `Waiting on ${people(pr.pendingReviewers)} · ${ago(pr.updatedAt)}`,
      variant: "info",
      mine: false,
    });
  else if (pr.reviewDecision === "REVIEW_REQUIRED")
    out.push({ label: "No reviewer assigned", variant: "warning", mine: true });
  if (pr.checks === "PENDING" || pr.checks === "EXPECTED")
    out.push({ label: "CI running", variant: "default", mine: false });
  return out;
}

export function prNeedsMe(pr: GithubPr) {
  return prSignals(pr).some((s) => s.mine && s.variant !== "default");
}

export function formatDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

/** React keys for rows without ids: each row's own key, with "#2", "#3"… on repeats so they stay unique. */
export function uniqueKeys<T>(items: readonly T[], keyOf: (item: T) => string): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const k = keyOf(item);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k}#${n}`;
  });
}
