import type { UsageLimits } from "../../../../shared/types.ts";

// ---------- formatting ----------

export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
export const fmtPct = (p: number) =>
  p === 0 ? "0%" : p < 0.1 ? "<0.1%" : p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;

// ---------- limits (T3 Code's "Usage limits" rows: label · bar · value) ----------

type Pace = "ahead" | "on" | "under";
export function paceOf(w: UsageLimits["windows"][number], now: number): Pace | undefined {
  if (!w.resetsAt) return;
  const left = (new Date(w.resetsAt).getTime() - now) / (w.minutes * 60_000);
  const elapsed = Math.min(1, Math.max(0, 1 - left)) * 100;
  if (elapsed < 2) return;
  return w.usedPercent > elapsed + 5 ? "ahead" : w.usedPercent < elapsed - 5 ? "under" : "on";
}
export const PACE_LABEL: Record<Pace, string> = { ahead: "Ahead of pace", on: "On pace", under: "Under pace" };

export function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
