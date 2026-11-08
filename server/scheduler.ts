import { execFileSync } from "node:child_process";
import type { RunKind, Settings } from "../shared/types.ts";
import { voiceJob } from "./claude/jobs.ts";
import { enqueue } from "./claude/runQueue.ts";
import { localDate } from "./store/helpers.ts";
import { store } from "./store/store.ts";

// Decides when Claude runs on its own. Ticks every minute; all state it needs
// (last run per kind) is persisted, so restarts and sleep don't double-run.

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const nowMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
const atTime = (d: Date, hhmm: string) => {
  const t = new Date(d);
  t.setHours(Math.floor(minutes(hhmm) / 60), minutes(hhmm) % 60, 0, 0);
  return t;
};
const ranToday = (kind: RunKind, now: Date) => {
  const last = store.lastRun(kind);
  return !!last && localDate(new Date(last)) === localDate(now);
};
const isWorkDay = (s: Settings, d: Date) => s.morning.days.includes(d.getDay());

function due(now = new Date()): RunKind[] {
  const s = store.settings();
  if (!isWorkDay(s, now)) return [];
  const out: RunKind[] = [];
  const t = nowMinutes(now);

  // Morning: once per work day, any time after the configured time (catches up after sleep/late launch).
  const briefToday = !!store.today().brief || ranToday("morning", now) || ranToday("manual", now);
  if (s.morning.enabled && t >= minutes(s.morning.time) && !briefToday) out.push("morning");

  // Pulse: only after today's brief exists, inside working hours, every N minutes.
  if (s.pulse.enabled && briefToday && t >= minutes(s.pulse.from) && t <= minutes(s.pulse.to)) {
    const lastAny = ["pulse", "morning", "manual"]
      .map((k) => store.lastRun(k as RunKind))
      .filter(Boolean)
      .sort()
      .at(-1);
    if (!lastAny || now.getTime() - new Date(lastAny).getTime() >= s.pulse.everyMinutes * 60_000) out.push("pulse");
  }

  if (s.wrapup.enabled && t >= minutes(s.wrapup.time) && !ranToday("wrapup", now) && briefToday) out.push("wrapup");
  return out;
}

/** Upcoming automatic runs, for the UI. */
export function nextRuns(now = new Date()): { kind: RunKind; at: string }[] {
  const s = store.settings();
  const out: { kind: RunKind; at: string }[] = [];
  const nextWorkDay = (from: Date) => {
    const d = new Date(from);
    for (let i = 0; i < 8 && !isWorkDay(s, d); i++) d.setDate(d.getDate() + 1);
    return d;
  };
  const tomorrow = () => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return nextWorkDay(d);
  };

  if (s.morning.enabled) {
    const today = isWorkDay(s, now) && !store.today().brief && !ranToday("morning", now);
    out.push({ kind: "morning", at: atTime(today ? now : tomorrow(), s.morning.time).toISOString() });
  }
  if (s.pulse.enabled && isWorkDay(s, now) && store.today().brief) {
    const last = ["pulse", "morning", "manual"]
      .map((k) => store.lastRun(k as RunKind))
      .filter(Boolean)
      .sort()
      .at(-1);
    const next = new Date(Math.max(now.getTime(), last ? new Date(last).getTime() + s.pulse.everyMinutes * 60_000 : 0));
    const from = atTime(now, s.pulse.from);
    const at = next < from ? from : next;
    if (at <= atTime(now, s.pulse.to)) out.push({ kind: "pulse", at: at.toISOString() });
  }
  if (s.wrapup.enabled && !ranToday("wrapup", now))
    out.push({ kind: "wrapup", at: atTime(isWorkDay(s, now) ? now : tomorrow(), s.wrapup.time).toISOString() });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Seconds since the last keyboard/mouse input (macOS), or 0 if unknown. Free, no tokens. */
export function idleSeconds(): number {
  try {
    const out = execFileSync("/usr/sbin/ioreg", ["-c", "IOHIDSystem", "-d", "4"], { encoding: "utf8", timeout: 3000 });
    const ns = /"HIDIdleTime" = (\d+)/.exec(out)?.[1];
    return ns ? Number(ns) / 1e9 : 0;
  } catch {
    return 0;
  }
}

export function startScheduler() {
  const tick = () => {
    const kinds = due();
    if (!kinds.length) return;
    // Nobody's looking: don't spend tokens on pulses/wrap-ups. They run once you're back,
    // since the interval has elapsed. The morning brief still runs so it's ready when you sit down.
    const idleLimit = store.settings().skipWhenIdleMinutes * 60;
    const away = idleLimit > 0 && idleSeconds() > idleLimit;
    for (const kind of kinds) {
      if (away && kind !== "morning") continue;
      enqueue(kind as Exclude<RunKind, "send" | "project" | "revise" | "voice" | "linear">, "schedule");
    }
  };
  // Voice: re-learn weekly, or sooner once you've rewritten 5+ drafts. At most one attempt a day,
  // after the morning brief, while you're around.
  const voiceTick = () => {
    const now = new Date();
    const s = store.settings();
    if (!isWorkDay(s, now) || !store.today().brief || ranToday("voice", now)) return;
    if (s.skipWhenIdleMinutes > 0 && idleSeconds() > s.skipWhenIdleMinutes * 60) return;
    const { profile, newEdits } = store.voiceState();
    const stale = !profile || now.getTime() - new Date(profile.updatedAt).getTime() > 7 * 86_400_000;
    if (stale || newEdits >= 5) enqueue(voiceJob("schedule"));
  };
  setInterval(voiceTick, 15 * 60_000);
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
