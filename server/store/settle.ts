// GitHub outcomes applied to what points at a PR: CI went green, the PR merged or closed.
import { now } from "./helpers.ts";
import type { Store } from "./store.ts";

/** CI went green on this PR: close todos that were only about fixing its CI. */
export function settleCiTodos(s: Store, url: string) {
  let n = 0;
  for (const t of s.today().todos)
    if (
      t.url === url &&
      t.status === "open" &&
      /\b(ci|checks?|build)\b/i.test(t.title) &&
      /\b(fix|red|fail)/i.test(t.title)
    ) {
      t.status = "done";
      t.doneAt = now();
      t.notes = t.notes ? `${t.notes} · auto: CI green` : "auto: CI green";
      n++;
    }
  if (n) s.save();
}

/** Close one todo or tracked item because code saw its reason go away (e.g. the PR it was about merged). */
export function closeAsDone(s: Store, kind: "todo" | "item", itemId: string, note: string) {
  if (kind === "todo") {
    const t = s.today().todos.find((x) => x.id === itemId);
    if (!t || t.status !== "open") return;
    Object.assign(t, { status: "done", doneAt: now(), notes: t.notes ? `${t.notes} · ${note}` : note });
  } else {
    const i = s.data.items.find((x) => x.id === itemId);
    if (!i) return;
    Object.assign(i, { state: "done", note: i.note ? `${i.note} · ${note}` : note, updatedAt: now() });
  }
  s.save();
}

/** Apply a GitHub outcome to everything that points at `url`. Returns how many things changed. */
export function settleUrl(s: Store, url: string, note: string): number {
  const day = s.today();
  let n = 0;
  for (const t of day.todos)
    if (t.url === url && t.status === "open") {
      t.status = "done";
      t.doneAt = now();
      t.notes = t.notes ? `${t.notes} · ${note}` : note;
      n++;
    }
  for (const m of day.messages)
    if (m.url === url && (m.status === "draft" || m.status === "approved")) {
      m.status = "dismissed";
      n++;
    }
  const before = s.data.items.length;
  s.data.items = s.data.items.filter((i) => i.url !== url);
  n += before - s.data.items.length;
  if (n) s.save();
  return n;
}
