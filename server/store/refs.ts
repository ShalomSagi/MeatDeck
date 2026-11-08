// Readable ids ("N-12"): the next number per prefix, and a backfill for entities stored before ids existed.
import type { RefPrefix } from "../../shared/types.ts";
import type { Store } from "./store.ts";

export function nextRef(s: Store, prefix: RefPrefix): string {
  const seq = (s.data.refSeq ??= {});
  seq[prefix] = (seq[prefix] ?? 0) + 1;
  return `${prefix}-${seq[prefix]}`;
}

/** Give every existing entity a readable id (oldest first, so numbers follow creation order). */
export function backfillRefs(s: Store) {
  const tag = <T extends { ref?: string; createdAt?: string; updatedAt?: string }>(list: T[], prefix: RefPrefix) =>
    [...list]
      .sort((a, b) => (a.createdAt ?? a.updatedAt ?? "").localeCompare(b.createdAt ?? b.updatedAt ?? ""))
      .forEach((x) => (x.ref ??= s.nextRef(prefix)));
  const days = Object.values(s.data.days).sort((a, b) => a.date.localeCompare(b.date));
  // Todos/drafts carried between days are copies of one thing: same id → same ref.
  const todoRefs = new Map<string, string>();
  const msgRefs = new Map<string, string>();
  for (const d of days) {
    for (const t of d.todos) t.ref ??= todoRefs.get(t.id) ?? (todoRefs.set(t.id, s.nextRef("T")), todoRefs.get(t.id)!);
    for (const m of d.messages) m.ref ??= msgRefs.get(m.id) ?? (msgRefs.set(m.id, s.nextRef("D")), msgRefs.get(m.id)!);
  }
  tag(s.data.notes ?? [], "N");
  tag(s.data.projects ?? [], "P");
  tag(s.data.items, "I");
  tag(s.data.rules ?? [], "R");
}
