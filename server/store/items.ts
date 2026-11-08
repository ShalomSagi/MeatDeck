// Tracked items (Linear issues, Slack threads…) that Claude upserts, and whether one is hidden.
import { hiddenBy, itemEntity, itemRepo, matchProjects } from "../../shared/projects.ts";
import type { OpenItem } from "../../shared/types.ts";
import { now, stripUndefined } from "./helpers.ts";
import { ensureLinearProjects } from "./projects.ts";
import type { Store } from "./store.ts";

export function upsertItems(
  s: Store,
  inputs: (Omit<OpenItem, "updatedAt"> & { updatedAt?: string })[],
  replaceSource?: OpenItem["source"],
) {
  if (replaceSource) {
    const incoming = new Set(inputs.map((i) => i.id));
    // Claude never sees hidden items, so a "replace" list must not delete them (unhiding brings them back).
    s.data.items = s.data.items.filter((i) => i.source !== replaceSource || incoming.has(i.id) || s.isHiddenItem(i));
  }
  for (const input of inputs) {
    const item = { ...stripUndefined(input), updatedAt: input.updatedAt ?? now() } as OpenItem;
    const idx = s.data.items.findIndex((i) => i.id === input.id);
    if (idx >= 0) s.data.items[idx] = { ...s.data.items[idx], ...item };
    else s.data.items.push({ ...item, ref: s.nextRef("I") });
  }
  s.data.items = s.data.items.filter((i) => i.state !== "done");
  ensureLinearProjects(s, inputs);
  s.save();
  return inputs.length;
}

export function isHiddenItem(s: Store, i: OpenItem): boolean {
  const ids = matchProjects(itemEntity(i), s.projects(), s.links());
  return hiddenBy(itemRepo(i), ids, s.projects(), s.settings().ignoredRepos);
}

export function removeItem(s: Store, itemId: string) {
  s.data.items = s.data.items.filter((i) => i.id !== itemId);
  s.save();
}
