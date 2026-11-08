// Projects: manual ones, Linear projects created automatically from tracked items, their matching
// rules and context, and explicit links for what no rule catches.
import { emptyRules } from "../../shared/projects.ts";
import type { OpenItem, Project, ProjectRules } from "../../shared/types.ts";
import { newId, NotFound, now } from "./helpers.ts";
import type { Store } from "./store.ts";

export function projects(s: Store): Project[] {
  return (s.data.projects ??= []);
}

export function links(s: Store): Record<string, string[]> {
  return (s.data.projectLinks ??= {});
}

/** Linear projects become MeatDeck projects automatically: plain code, no tokens. */
export function ensureLinearProjects(s: Store, items: Pick<OpenItem, "source" | "project">[]) {
  for (const i of items) {
    if (i.source !== "linear" || !i.project) continue;
    const name = i.project.trim();
    const all = s.projects();
    if (all.some((p) => p.rules.linearProjects.some((l) => l.toLowerCase() === name.toLowerCase()))) continue;
    const sameName = all.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (sameName) sameName.rules.linearProjects.push(name);
    else
      all.push({
        ref: s.nextRef("P"),
        id: newId(),
        name,
        description: "",
        kind: "linear",
        rules: { ...emptyRules(), linearProjects: [name] },
        createdAt: now(),
        updatedAt: now(),
      });
  }
}

export function createProject(s: Store, input: { name: string; description: string }): Project {
  const p: Project = {
    ref: s.nextRef("P"),
    id: newId(),
    name: input.name.trim(),
    description: input.description.trim(),
    kind: "manual",
    rules: emptyRules(),
    createdAt: now(),
    updatedAt: now(),
  };
  s.projects().push(p);
  s.save();
  return p;
}

function findProject(s: Store, projectId: string): Project {
  const p = s.projects().find((x) => x.id === projectId);
  if (!p) throw new NotFound(`project ${projectId}`);
  return p;
}

export function updateProject(
  s: Store,
  projectId: string,
  patch: Partial<Pick<Project, "name" | "description" | "ignored" | "lastDiscoveryAt" | "url" | "linearPriority">> & {
    /** Your MeatDeck priority 0–4; null = follow Linear again. */
    priority?: number | null;
    /** The description came from Linear (Linear projects only get their description this way). */
    fromLinear?: boolean;
    context?: string;
    addRules?: Partial<ProjectRules>;
    removeRules?: Partial<ProjectRules>;
  },
): Project {
  const p = findProject(s, projectId);
  if (patch.name !== undefined) p.name = patch.name.trim() || p.name;
  // A Linear project's description is Linear's; only a sync from Linear may change it.
  if (patch.description !== undefined && (p.kind !== "linear" || patch.fromLinear))
    p.description = patch.description.trim();
  if (patch.url !== undefined) p.url = patch.url;
  if (patch.fromLinear) p.linearSyncedAt = now();
  if (patch.ignored !== undefined) p.ignored = patch.ignored;
  if (patch.priority !== undefined) {
    if (patch.priority === null || !(patch.priority >= 0 && patch.priority <= 4)) delete p.priority;
    else p.priority = Math.round(patch.priority);
  }
  // Linear's priority is Linear's: only a sync from Linear writes it.
  if (patch.linearPriority !== undefined && patch.fromLinear && patch.linearPriority >= 0 && patch.linearPriority <= 4)
    p.linearPriority = Math.round(patch.linearPriority);
  if (patch.lastDiscoveryAt !== undefined) p.lastDiscoveryAt = patch.lastDiscoveryAt;
  if (patch.context !== undefined) p.context = { summary: patch.context.trim(), updatedAt: now() };
  for (const key of Object.keys(p.rules) as (keyof ProjectRules)[]) {
    const add = (patch.addRules?.[key] ?? []).map((v) => v.trim().replace(/^#/, "")).filter(Boolean);
    const remove = new Set((patch.removeRules?.[key] ?? []).map((v) => v.trim().replace(/^#/, "").toLowerCase()));
    const merged = [
      ...p.rules[key],
      ...add.filter((v) => !p.rules[key].some((x) => x.toLowerCase() === v.toLowerCase())),
    ];
    p.rules[key] = merged.filter((v) => !remove.has(v.toLowerCase()));
  }
  p.updatedAt = now();
  s.save();
  return p;
}

export function deleteProject(s: Store, projectId: string) {
  s.data.projects = s.projects().filter((p) => p.id !== projectId);
  for (const [key, ids] of Object.entries(s.links())) {
    const rest = ids.filter((i) => i !== projectId);
    if (rest.length) s.links()[key] = rest;
    else delete s.links()[key];
  }
  s.save();
}

/** Explicit links for things no rule catches. Prefer rules: they also match future items. */
export function linkToProject(s: Store, projectId: string, keys: string[], unlink = false) {
  findProject(s, projectId);
  for (const key of keys) {
    const cur = s.links()[key] ?? [];
    const next = unlink ? cur.filter((i) => i !== projectId) : [...new Set([...cur, projectId])];
    if (next.length) s.links()[key] = next;
    else delete s.links()[key];
  }
  s.save();
}
