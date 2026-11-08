// Claude Code probe: `--version`, then the stream-json `initialize` control request (the same one
// the Agent SDK's initializationResult() sends) for its model list and account. No prompt is sent.
// Claude chat turns run in server/chat/claudeTurn.ts, not through this registry.
import type { ProviderModel, ProviderStatus } from "../../shared/providers.ts";
import { base, jsonDialog, versionOf } from "./cliProbe.ts";

/** Claude Code's answer to the stream-json `initialize` control request (the fields read here). */
interface ClaudeModel {
  value?: string;
  displayName?: string;
  description?: string;
  resolvedModel?: string;
  supportsEffort?: boolean;
  supportedEffortLevels?: string[];
}
interface ClaudeInit {
  models?: ClaudeModel[];
  account?: { email?: string; apiKeySource?: string; subscriptionType?: string };
}

export async function probeClaude(): Promise<ProviderStatus> {
  const s = base("claude");
  if (!(await versionOf("claude", s))) return s;
  try {
    const init = await jsonDialog(
      "claude",
      ["-p", "--output-format", "stream-json", "--input-format", "stream-json", "--verbose"],
      [{ type: "control_request", request_id: "meatdeck-probe", request: { subtype: "initialize" } }],
      (j: { type?: string; response?: { response?: ClaudeInit } }) =>
        j.type === "control_response" ? (j.response?.response ?? {}) : undefined,
    );
    const reported = init.models ?? [];
    const defaultResolved = reported.find((m) => m.value === "default")?.resolvedModel;
    s.models = reported
      .filter((m): m is ClaudeModel & { value: string } => !!m.value && m.value !== "default")
      .map((m): ProviderModel => ({
        slug: m.value,
        name: m.displayName || m.value,
        ...(m.description ? { description: m.description } : {}),
        // The alias Claude Code resolves "default" to (e.g. sonnet) is the default.
        ...(defaultResolved && m.resolvedModel === defaultResolved && !m.value.startsWith("claude-")
          ? { isDefault: true }
          : {}),
        ...(m.supportsEffort && m.supportedEffortLevels?.length ? { efforts: m.supportedEffortLevels } : {}),
      }));
    const acct = init.account ?? {};
    s.auth =
      acct.email || acct.apiKeySource || acct.subscriptionType
        ? {
            status: "authenticated",
            label: [acct.email, acct.subscriptionType].filter(Boolean).join(" · ") || "API key",
          }
        : { status: "unknown" };
    s.status = s.models.length ? "ready" : "warning";
    if (!s.models.length) s.message = "Claude Code didn't report any models.";
  } catch (err) {
    s.status = "warning";
    s.message = `Couldn't read models from Claude Code (${(err as Error).message}).`;
  }
  return s;
}
