// Codex: the probe (`codex app-server` JSON-RPC `model/list` + `account/read`, falling back to
// ~/.codex/models_cache.json) and chat turns (`codex exec --json`, MeatDeck's MCP injected via -c).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderModel, ProviderStatus } from "../../shared/providers.ts";
import { resolveBin } from "../shellEnv.ts";
import { meatdeckMcp, texts, type AgentEvent, type TurnInput } from "./agentTurn.ts";
import { base, exec, jsonDialog, stripAnsi, versionOf } from "./cliProbe.ts";

type CodexEffort = string | { reasoningEffort?: string; effort?: string };
/** A Codex model, from app-server `model/list` (camelCase) or ~/.codex/models_cache.json (snake_case). */
interface CodexModel {
  model?: string;
  slug?: string;
  displayName?: string;
  display_name?: string;
  description?: string;
  isDefault?: boolean;
  supportedReasoningEfforts?: CodexEffort[];
  supported_reasoning_levels?: CodexEffort[];
  defaultReasoningEffort?: string;
  default_reasoning_level?: string;
  hidden?: boolean;
  visibility?: string;
}
interface CodexAccount {
  email?: string;
  planType?: string;
  type?: string;
}
/** One JSON-RPC message from `codex app-server`. */
interface CodexRpc {
  id?: number;
  result?: { account?: CodexAccount | null; data?: CodexModel[]; nextCursor?: string };
  error?: { message?: string };
}

const codexModel = (m: CodexModel): ProviderModel => ({
  slug: (m.model ?? m.slug)!,
  name: (m.displayName ?? m.display_name ?? m.model ?? m.slug)!,
  ...(m.description ? { description: m.description } : {}),
  ...(m.isDefault ? { isDefault: true } : {}),
  efforts: (m.supportedReasoningEfforts ?? m.supported_reasoning_levels ?? [])
    .map((e) => (typeof e === "string" ? e : (e.reasoningEffort ?? e.effort)))
    .filter((e): e is string => !!e),
  ...((m.defaultReasoningEffort ?? m.default_reasoning_level)
    ? { defaultEffort: m.defaultReasoningEffort ?? m.default_reasoning_level }
    : {}),
});

export async function probeCodex(): Promise<ProviderStatus> {
  const s = base("codex");
  if (!(await versionOf("codex", s))) return s;
  try {
    const models: ProviderModel[] = [];
    let account: CodexAccount | null | undefined;
    let listed = false;
    await jsonDialog(
      "codex",
      ["app-server"],
      [{ id: 1, method: "initialize", params: { clientInfo: { name: "meatdeck", version: "0.1.0" } } }],
      (j: CodexRpc, send) => {
        if (j.id === 1) {
          send({ method: "initialized" });
          send({ id: 2, method: "account/read", params: {} });
          send({ id: 10, method: "model/list", params: {} });
        } else if (j.id === 2) account = j.result?.account ?? null;
        else if (typeof j.id === "number" && j.id >= 10) {
          if (j.error) throw new Error(j.error.message ?? "model/list failed");
          for (const m of j.result?.data ?? []) if (!m.hidden) models.push(codexModel(m));
          if (j.result?.nextCursor)
            send({ id: j.id + 1, method: "model/list", params: { cursor: j.result.nextCursor } });
          else listed = true;
        }
        return listed && account !== undefined ? true : undefined;
      },
    );
    s.models = models;
    if (account !== undefined) {
      s.auth = account
        ? {
            status: "authenticated",
            label:
              [account.email, account.planType && `ChatGPT ${account.planType}`].filter(Boolean).join(" · ") ||
              account.type,
          }
        : { status: "unauthenticated" };
    }
  } catch (err) {
    // The CLI keeps a shared model cache; good enough when app-server is unhappy.
    try {
      const c: { models?: CodexModel[] } = JSON.parse(
        readFileSync(join(homedir(), ".codex", "models_cache.json"), "utf8"),
      );
      s.models = (c.models ?? []).filter((m) => m.visibility !== "hide").map(codexModel);
    } catch {}
    s.message = `codex app-server didn't answer (${(err as Error).message}); using its cached model list.`;
  }
  if (s.auth.status === "unknown") {
    const st = await exec("codex", ["login", "status"]);
    s.auth =
      st.code === 0 && /logged in/i.test(st.out)
        ? { status: "authenticated", label: stripAnsi(st.out).trim().split("\n")[0] }
        : { status: "unauthenticated" };
  }
  s.status =
    s.auth.status === "unauthenticated" ? "error" : s.models.length ? (s.message ? "warning" : "ready") : "warning";
  if (s.auth.status === "unauthenticated") s.message = "Not signed in. Run `codex login`.";
  return s;
}

const toml = (s: string) => JSON.stringify(s);

export function codexTurnCommand(t: TurnInput): { bin: string; args: string[] } {
  const mcp = meatdeckMcp();
  const env = { ...mcp.env, ...t.mcpEnv, MCP_TOOL_TIMEOUT: "960000" };
  const config = [
    `sandbox_mode="read-only"`,
    `mcp_servers.meatdeck.command=${toml(mcp.command)}`,
    `mcp_servers.meatdeck.args=[${mcp.args.map(toml).join(",")}]`,
    `mcp_servers.meatdeck.env={${Object.entries(env)
      .map(([k, v]) => `${k}=${toml(v)}`)
      .join(",")}}`,
    `mcp_servers.meatdeck.default_tools_approval_mode="approve"`,
    `mcp_servers.meatdeck.tool_timeout_sec=960`,
    ...(t.effort ? [`model_reasoning_effort=${toml(t.effort)}`] : []),
  ].flatMap((c) => ["-c", c]);
  return {
    bin: resolveBin("codex"),
    args: [
      "exec",
      ...(t.resume ? ["resume"] : []),
      "--json",
      "--skip-git-repo-check",
      "-m",
      t.model,
      ...config,
      ...(t.resume ? [t.resume] : []),
      "--",
      t.prompt,
    ],
  };
}

/** The fields read from `codex exec --json` events. */
interface CodexItem {
  id: string;
  type?: string;
  text?: string;
  server?: string;
  tool?: string;
  arguments?: unknown;
  command?: string;
  query?: string;
  status?: string;
  error?: { message?: unknown } | null;
  result?: { content?: unknown } | null;
  exit_code?: number | null;
  aggregated_output?: string | null;
  message: string;
}
interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: CodexItem;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
  message?: string;
}

/** Normalized events from one `codex exec --json` line. */
export function codexEvents(parsed: unknown): AgentEvent[] {
  const ev = parsed as CodexEvent;
  const item = ev.item;
  switch (ev.type) {
    case "thread.started":
      return ev.thread_id ? [{ type: "session", id: ev.thread_id }] : [];
    case "item.started":
      if (item?.type === "mcp_tool_call")
        return [{ type: "tool", id: item.id, name: `mcp__${item.server}__${item.tool}`, input: item.arguments }];
      if (item?.type === "command_execution")
        return [{ type: "tool", id: item.id, name: "Bash", input: { command: item.command } }];
      if (item?.type === "web_search")
        return [{ type: "tool", id: item.id, name: "WebSearch", input: { query: item.query } }];
      return [];
    case "item.completed":
      if (item?.type === "agent_message") return item.text ? [{ type: "text", text: item.text, delta: false }] : [];
      if (item?.type === "mcp_tool_call")
        return [
          {
            type: "tool_result",
            id: item.id,
            isError: !!item.error || item.status === "failed",
            raw: item.error ? texts(item.error.message ?? item.error) : texts(item.result?.content),
          },
        ];
      if (item?.type === "command_execution")
        return [
          {
            type: "tool_result",
            id: item.id,
            isError: item.exit_code !== 0,
            raw: String(item.aggregated_output ?? ""),
          },
        ];
      if (item?.type === "error") return [{ type: "error", message: item.message }];
      return [];
    case "turn.completed": {
      const u = ev.usage ?? {};
      return [{ type: "usage", tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) }];
    }
    case "turn.failed":
      return [{ type: "error", message: ev.error?.message ?? "Codex turn failed" }];
    case "error":
      return [{ type: "error", message: ev.message ?? "Codex error" }];
  }
  return [];
}
