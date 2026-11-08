// Per-row state on the action queue: priorities (Claude's judgment), snoozes and dismissals (yours).
import type { PriorityOverride } from "../../shared/actions.ts";
import type { Dismissal } from "../../shared/types.ts";
import { localDate, now } from "./helpers.ts";
import type { Store } from "./store.ts";

/** Overrides older than ~30h are dropped: each morning brief re-judges. */
export function priorities(s: Store): Record<string, PriorityOverride> {
  const all = (s.data.priorities ??= {});
  const cutoff = Date.now() - 30 * 3_600_000;
  for (const [k, v] of Object.entries(all)) if (new Date(v.at).getTime() < cutoff) delete all[k];
  return all;
}

export function setPriorities(
  s: Store,
  list: {
    key: string;
    tier: PriorityOverride["tier"];
    why: string;
    score?: number;
    verb?: PriorityOverride["verb"];
  }[],
) {
  const all = s.priorities();
  for (const p of list)
    all[p.key] = { tier: p.tier, why: p.why.trim(), score: p.score, ...(p.verb ? { verb: p.verb } : {}), at: now() };
  s.save();
}

export function clearPriority(s: Store, key: string) {
  delete s.priorities()[key];
  s.save();
}

export function snoozes(s: Store): Record<string, string> {
  const all = (s.data.snoozes ??= {});
  const today = localDate();
  for (const [k, until] of Object.entries(all)) if (until <= today) delete all[k];
  return all;
}

export function snooze(s: Store, key: string, until: string) {
  s.snoozes()[key] = until;
  s.save();
}

/** Dismissed for good (kept 90 days, which is longer than anything stays relevant). */
export function dismissals(s: Store): Record<string, Dismissal> {
  const all = (s.data.dismissed ??= {});
  const cutoff = Date.now() - 90 * 86_400_000;
  for (const [k, d] of Object.entries(all)) if (new Date(d.at).getTime() < cutoff) delete all[k];
  return all;
}

export function dismiss(s: Store, d: Omit<Dismissal, "at">) {
  // Close what the row stood for, so nothing else (Today counts, Claude's digest) keeps it alive.
  if (d.todoId) {
    const t = s.today().todos.find((x) => x.id === d.todoId);
    if (t && t.status === "open") Object.assign(t, { status: d.done ? "done" : "skipped", doneAt: now() });
  }
  if (d.messageId) {
    const m = s.today().messages.find((x) => x.id === d.messageId);
    if (m && (m.status === "draft" || m.status === "approved")) m.status = "dismissed";
  }
  s.dismissals()[d.key] = { ...d, at: now() };
  delete s.snoozes()[d.key];
  s.save();
}

export function undismiss(s: Store, key: string) {
  const d = s.dismissals()[key];
  if (!d) return;
  if (d.todoId) {
    const t = s.today().todos.find((x) => x.id === d.todoId);
    if (t && (t.status === "skipped" || (d.done && t.status === "done")))
      Object.assign(t, { status: "open", doneAt: undefined });
  }
  if (d.messageId) {
    const m = s.today().messages.find((x) => x.id === d.messageId);
    if (m && m.status === "dismissed") m.status = "draft";
  }
  delete s.dismissals()[key];
  s.save();
}
