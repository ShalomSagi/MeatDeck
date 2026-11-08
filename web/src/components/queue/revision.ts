// Whether a Change… run is pending or just finished for one card.
import type { DashboardState } from "../../../../shared/types.ts";

export interface Revision {
  pending: boolean;
  instruction?: string;
  /** The last finished change for this card (recent only), to show what happened. */
  last?: { summary?: string; failed: boolean; at: string };
}

export function revisionOf(state: DashboardState, target: string): Revision {
  const running = state.run?.status === "running" && state.run.target === target ? state.run : undefined;
  const queued = state.nextRuns.some((n) => n.target === target);
  const last = state.runs.find((r) => r.target === target && r.status !== "running");
  const recent = last?.finishedAt && Date.now() - new Date(last.finishedAt).getTime() < 15 * 60_000;
  return {
    pending: !!running || queued,
    instruction: running?.instruction,
    last:
      recent && last ? { summary: last.summary, failed: last.status === "failed", at: last.finishedAt! } : undefined,
  };
}
