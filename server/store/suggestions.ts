// Suggestions: Claude proposes a project, the user decides.
import type { Project, Suggestion } from "../../shared/types.ts";
import { newId, NotFound, now } from "./helpers.ts";
import type { Store } from "./store.ts";

export function suggestions(s: Store): Suggestion[] {
  return (s.data.suggestions ??= []);
}

/**
 * Guards in code, so a chatty run can't flood the user: needs 2+ pieces of evidence, at most 5
 * pending, and nothing that looks like an existing project or a suggestion already made
 * (dismissed ones stay remembered for 60 days).
 */
export function addSuggestion(
  s: Store,
  input: Pick<Suggestion, "name" | "description" | "why" | "evidence" | "rules" | "keys">,
): { ok: true; suggestion: Suggestion } | { ok: false; reason: string } {
  const name = input.name.trim();
  const evidence = (input.evidence ?? []).filter((e) => e.text?.trim());
  if (!name) return { ok: false, reason: "name required" };
  if (evidence.length < 2)
    return {
      ok: false,
      reason:
        "Needs at least 2 concrete signals of active work (a PR, an in-progress ticket, a dated plan). Don't suggest it.",
    };
  const clash = s.projects().find((p) => similarName(p.name, name));
  if (clash)
    return {
      ok: false,
      reason: `Looks like the existing project "${clash.name}" (${clash.ref}). Teach that project with update_project instead.`,
    };
  const cutoff = Date.now() - 60 * 86_400_000;
  const prior = s
    .suggestions()
    .find(
      (x) =>
        similarName(x.name, name) &&
        (x.status === "pending" ||
          (x.status === "dismissed" && new Date(x.decidedAt ?? x.createdAt).getTime() > cutoff)),
    );
  if (prior)
    return {
      ok: false,
      reason:
        prior.status === "pending"
          ? `Already suggested (${prior.ref}).`
          : `The user dismissed "${prior.name}": not active work. Don't suggest it again.`,
    };
  if (s.suggestions().filter((x) => x.status === "pending").length >= 5)
    return { ok: false, reason: "5 suggestions are already waiting for the user. Don't add more." };
  const suggestion: Suggestion = {
    id: newId(),
    ref: s.nextRef("S"),
    kind: "project",
    name,
    description: input.description?.trim() ?? "",
    why: input.why?.trim() ?? "",
    evidence: evidence
      .slice(0, 6)
      .map((e) => ({ text: e.text.trim().slice(0, 200), ...(e.url ? { url: e.url } : {}) })),
    ...(input.rules ? { rules: input.rules } : {}),
    ...(input.keys?.length ? { keys: input.keys } : {}),
    status: "pending",
    createdAt: now(),
  };
  s.suggestions().push(suggestion);
  s.save();
  return { ok: true, suggestion };
}

export function acceptSuggestion(
  s: Store,
  suggestionId: string,
  patch: { name?: string; description?: string } = {},
): Project {
  const sg = s.suggestions().find((x) => x.id === suggestionId);
  if (!sg) throw new NotFound(`suggestion ${suggestionId}`);
  const p = s.createProject({ name: patch.name ?? sg.name, description: patch.description ?? sg.description });
  s.updateProject(p.id, { addRules: sg.rules, context: sg.why });
  if (sg.keys?.length) s.linkToProject(p.id, sg.keys);
  Object.assign(sg, { status: "accepted", projectId: p.id, decidedAt: now() });
  s.save();
  return p;
}

export function dismissSuggestion(s: Store, suggestionId: string) {
  const sg = s.suggestions().find((x) => x.id === suggestionId);
  if (!sg) throw new NotFound(`suggestion ${suggestionId}`);
  Object.assign(sg, { status: "dismissed", decidedAt: now() });
  // Keep the last 100 decisions: dismissed names are what stops re-suggesting.
  s.data.suggestions = s
    .suggestions()
    .filter((x) => x.status === "pending")
    .concat(
      s
        .suggestions()
        .filter((x) => x.status !== "pending")
        .slice(-100),
    );
  s.save();
}

/** "Dashboard Vite migration" ≈ "Vite migration of the dashboard": same words or one contains the other. */
function similarName(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["the", "and", "for", "project"].includes(w)),
    );
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size) >= 0.75;
}
