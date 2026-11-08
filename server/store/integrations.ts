// Integrations as stored: the predefined ones seeded once, plus the user's own.
import { PREDEFINED } from "../../shared/integrationPresets.ts";
import type { Integration } from "../../shared/integrations.ts";
import { NotFound } from "./helpers.ts";
import type { Store } from "./store.ts";

/** Predefined integrations are seeded once; later releases' new actions fill in; user edits are kept. */
export function integrations(s: Store): Integration[] {
  const list = (s.data.integrations ??= []);
  for (const def of PREDEFINED) {
    const cur = list.find((i) => i.id === def.id);
    if (!cur) list.push(structuredClone(def));
    else for (const [a, impl] of Object.entries(def.actions)) cur.actions[a] ??= structuredClone(impl);
  }
  return list;
}

export function integration(s: Store, integrationId: string): Integration | undefined {
  return s.integrations().find((i) => i.id === integrationId);
}

export function saveIntegration(s: Store, input: Integration): Integration {
  const list = s.integrations();
  const idx = list.findIndex((i) => i.id === input.id);
  const next = { ...input, predefined: idx >= 0 ? list[idx].predefined : false };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  s.save();
  return next;
}

export function deleteIntegration(s: Store, integrationId: string) {
  const i = s.integration(integrationId);
  if (!i || i.predefined) throw new NotFound(`custom integration ${integrationId}`);
  s.data.integrations = s.integrations().filter((x) => x.id !== integrationId);
  s.save();
}
