// Scoring for the action queue: tiers, due-date boosts and work-day math (only the configured
// work days count). Pure code, used by buildActions in actions.ts.
import type { Tier } from "./actions.ts";

export const TIER_FLOOR: Record<Tier, number> = { now: 70, today: 40, watch: 0 };
export const tierOf = (score: number): Tier => (score >= 70 ? "now" : score >= 40 ? "today" : "watch");

/** Elapsed work days (only the configured work days count; Fri/Sat by default don't). */
export function workDaysSince(iso: string, workDays: number[], now = new Date()): number {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime()) || start >= now) return 0;
  const until = now.getTime();
  let ms = 0;
  for (let t = start.getTime(); t < until;) {
    const next = new Date(t);
    next.setHours(24, 0, 0, 0);
    if (workDays.includes(new Date(t).getDay())) ms += Math.min(next.getTime(), until) - t;
    t = next.getTime();
  }
  return ms / 86_400_000;
}

export const dueBoost = (due: string | undefined, today: string) => {
  if (!due) return 0;
  if (due < today) return 35;
  if (due === today) return 28;
  const d = Math.round((new Date(`${due}T00:00`).getTime() - new Date(`${today}T00:00`).getTime()) / 86_400_000);
  return d === 1 ? 12 : d <= 3 ? 5 : 0;
};
