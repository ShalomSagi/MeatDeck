// Rules: followed by every Claude run; ignore_check rules are also enforced in code (github.ts).
// Learned preferences are instruction rules (migrated once); preferences() is their older shape.
import type { Preference, Rule } from "../../shared/types.ts";
import { newId, NotFound, now, stripUndefined } from "./helpers.ts";
import type { Store } from "./store.ts";

export function rules(s: Store): Rule[] {
  if (!s.data.rules) {
    // Migration: learned preferences become instruction rules.
    s.data.rules = (s.data.preferences ?? []).map((p) => ({
      id: p.id,
      kind: "instruction" as const,
      text: p.text,
      enabled: true,
      by: "learned" as const,
      from: p.from,
      createdAt: p.createdAt,
    }));
    delete s.data.preferences;
  }
  return s.data.rules;
}

export function addRule(
  s: Store,
  input: { kind?: Rule["kind"]; text: string; pattern?: string; by?: Rule["by"]; from?: string },
): Rule {
  const text = input.text.trim();
  const kind = input.kind ?? "instruction";
  const dup = s
    .rules()
    .find(
      (r) =>
        r.kind === kind &&
        (kind === "ignore_check"
          ? r.pattern?.toLowerCase() === input.pattern?.trim().toLowerCase()
          : r.text.toLowerCase() === text.toLowerCase()),
    );
  if (dup) {
    Object.assign(dup, { text, enabled: true });
    s.save();
    return dup;
  }
  const rule: Rule = {
    id: newId(),
    ref: s.nextRef("R"),
    kind,
    text,
    pattern: input.pattern?.trim() || undefined,
    enabled: true,
    by: input.by ?? "you",
    from: input.from,
    createdAt: now(),
  };
  s.rules().push(rule);
  s.save();
  return rule;
}

export function updateRule(
  s: Store,
  ruleId: string,
  patch: Partial<Pick<Rule, "text" | "pattern" | "enabled" | "kind">>,
): Rule {
  const r = s.rules().find((x) => x.id === ruleId);
  if (!r) throw new NotFound(`rule ${ruleId}`);
  Object.assign(r, stripUndefined(patch));
  s.save();
  return r;
}

export function removeRule(s: Store, ruleId: string) {
  s.data.rules = s.rules().filter((r) => r.id !== ruleId);
  s.save();
}

/** Compat: the instruction rules, in the shape older callers expect. */
export function preferences(s: Store): Preference[] {
  return s
    .rules()
    .filter((r) => r.enabled && r.kind === "instruction")
    .map((r) => ({ id: r.id, text: r.text, from: r.from, createdAt: r.createdAt }));
}

export function addPreference(s: Store, text: string, from?: string): Preference {
  const r = s.addRule({ kind: "instruction", text, by: "learned", from });
  return { id: r.id, text: r.text, from: r.from, createdAt: r.createdAt };
}

export function removePreference(s: Store, prefId: string) {
  s.removeRule(prefId);
}
