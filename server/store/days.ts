// Days: today's day (created on first access, with yesterday's open todos carried over) and history.
import type { Day, Todo } from "../../shared/types.ts";
import { localDate } from "./helpers.ts";
import type { Store } from "./store.ts";

/** Today's day, created on first access. Unfinished todos from the last day roll over. */
export function today(s: Store): Day {
  const date = localDate();
  let day = s.data.days[date];
  if (day) return day;

  const previous = Object.keys(s.data.days)
    .filter((d) => d < date)
    .sort()
    .at(-1);
  const carried: Todo[] = previous
    ? s.data.days[previous].todos
        .filter((t) => t.status === "open")
        // Anything now due (or overdue) becomes P0 on the new day: plain date math, no tokens.
        .map((t) => ({
          ...t,
          carriedFrom: t.carriedFrom ?? previous,
          ...(t.due && t.due <= date ? { priority: "p0" as const } : {}),
        }))
    : [];
  day = { date, todos: carried, messages: [] };
  s.data.days[date] = day;
  s.save();
  return day;
}

export function history(s: Store, limit = 14) {
  return Object.values(s.data.days)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((d) => ({
      date: d.date,
      done: d.todos.filter((t) => t.status === "done").length,
      total: d.todos.length,
    }));
}

/** Every stored day, newest first. */
export function allDays(s: Store): Day[] {
  return Object.values(s.data.days).sort((a, b) => b.date.localeCompare(a.date));
}
