// Agent providers MeatDeck can run, modelled on T3 Code's provider registry: each provider is a CLI
// on this Mac, probed with zero-token calls (version, auth, model list) and cached. Chat can run on
// any ready provider; scheduled runs stay on Claude (they need Claude's skills and connectors).

export const PROVIDER_IDS = ["claude", "codex", "cursor"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export interface ProviderModel {
  /** What we pass to the CLI's --model ("opus", "gpt-6.1-sol", "composer-2.5"). */
  slug: string;
  name: string;
  description?: string;
  /** The provider's own default. */
  isDefault?: boolean;
  /** Reasoning levels the model accepts (empty = none to pick). */
  efforts?: string[];
  defaultEffort?: string;
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  enabled: boolean;
  installed: boolean;
  version?: string;
  /** "ready": installed and signed in; "warning": works but something's off; "error": can't run. */
  status: "ready" | "warning" | "error" | "disabled";
  auth: { status: "authenticated" | "unauthenticated" | "unknown"; label?: string };
  models: ProviderModel[];
  message?: string;
  checkedAt?: string;
  /** Probe in flight. */
  checking?: boolean;
}

/** A model choice: which provider, which model, and optionally how hard it thinks. */
export interface ModelSelection {
  provider: ProviderId;
  model: string;
  effort?: string;
}

export const EFFORT_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
  ultra: "Ultra",
};

/** Older chats and settings stored just a Claude model name. */
export function asSelection(model: string | undefined, provider?: ProviderId, effort?: string): ModelSelection {
  return { provider: provider ?? "claude", model: model || "haiku", ...(effort ? { effort } : {}) };
}

export function modelLabel(sel: ModelSelection, providers: ProviderStatus[] | undefined): string {
  const p = providers?.find((x) => x.id === sel.provider);
  return p?.models.find((m) => m.slug === sel.model)?.name ?? sel.model;
}
