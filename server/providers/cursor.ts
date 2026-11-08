// Cursor: the probe (`cursor-agent --version`, `status`, `models`) and chat turns
// (`cursor-agent -p --output-format stream-json`, MCP and permissions in ~/.meatdeck/.cursor).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderStatus } from "../../shared/providers.ts";
import { resolveBin } from "../shellEnv.ts";
import { DATA_DIR } from "../store/persistence.ts";
import { meatdeckMcp, texts, type AgentEvent, type TurnInput } from "./agentTurn.ts";
import { base, exec, stripAnsi, versionOf } from "./cliProbe.ts";

export async function probeCursor(): Promise<ProviderStatus> {
  const s = base("cursor");
  if (!(await versionOf("cursor", s))) return s;
  const [st, ms] = await Promise.all([exec("cursor-agent", ["status"]), exec("cursor-agent", ["models"], 30_000)]);
  const who = /logged in as\s+(\S+)/i.exec(stripAnsi(st.out))?.[1];
  s.auth = who
    ? { status: "authenticated", label: who }
    : /not logged in|login/i.test(st.out)
      ? { status: "unauthenticated" }
      : { status: "unknown" };
  s.models = stripAnsi(ms.out)
    .split("\n")
    .map((l) => /^\s*([\w.\-[\]=,]+)\s+-\s+(.+?)\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => {
      const def = /\(default\)/i.test(m[2]);
      return {
        slug: m[1],
        name: m[2]
          .replace(/\s*\((?:default|current)\)/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim(),
        ...(def ? { isDefault: true } : {}),
      };
    });
  s.status = s.auth.status === "unauthenticated" ? "error" : s.models.length ? "ready" : "warning";
  if (s.auth.status === "unauthenticated") s.message = "Not signed in. Run `cursor-agent login`.";
  else if (!s.models.length) s.message = "cursor-agent didn't list any models.";
  return s;
}

export function cursorTurnCommand(t: TurnInput): { bin: string; args: string[] } {
  writeCursorWorkspace();
  return {
    bin: resolveBin("cursor-agent"),
    args: [
      "-p",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--model",
      t.model,
      "--approve-mcps",
      "--trust",
      "--workspace",
      DATA_DIR,
      ...(t.resume ? ["--resume", t.resume] : []),
      t.prompt,
    ],
  };
}

/** Cursor reads MCP servers and permissions from the workspace's .cursor folder. */
function writeCursorWorkspace() {
  const dir = join(DATA_DIR, ".cursor");
  mkdirSync(dir, { recursive: true });
  const mcp = meatdeckMcp();
  writeFileSync(
    join(dir, "mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          meatdeck: { command: mcp.command, args: mcp.args, env: { ...mcp.env, MCP_TOOL_TIMEOUT: "960000" } },
        },
      },
      null,
      2,
    ),
  );
  // Same boundary as Claude chat: MeatDeck + gh/git reads, no file writes in MeatDeck's data dir.
  writeFileSync(
    join(dir, "cli.json"),
    JSON.stringify(
      {
        permissions: {
          allow: ["Mcp(meatdeck:*)", "Shell(gh)", "Shell(git)", "Shell(date)", "Read(**)"],
          deny: ["Write(**)"],
        },
      },
      null,
      2,
    ),
  );
}

/** The fields read from `cursor-agent --output-format stream-json` events. */
interface CursorToolCall {
  args?: { providerIdentifier?: string; serverIdentifier?: string; toolName?: string; args?: unknown };
  result?: {
    success?: { content?: unknown; stdout?: unknown };
    rejected?: { reason?: unknown };
    error?: { message?: unknown };
    failure?: unknown;
  };
}
interface CursorEvent {
  type?: string;
  subtype?: string;
  session_id?: string;
  call_id: string;
  timestamp_ms?: number;
  message?: { content?: unknown };
  tool_call?: Record<string, CursorToolCall>;
  usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number };
  is_error?: boolean;
  result?: unknown;
}

/** Normalized events from `cursor-agent` lines. Stateful per turn (Cursor repeats the full text at the end). */
export function cursorParser(): (parsed: unknown) => AgentEvent[] {
  let sawDelta = false;
  return (parsed) => {
    const ev = parsed as CursorEvent;
    switch (ev.type) {
      case "system":
        return ev.session_id ? [{ type: "session", id: ev.session_id }] : [];
      case "assistant": {
        const text = texts(ev.message?.content);
        if (!text) return [];
        // With --stream-partial-output, deltas carry timestamp_ms; the final full message doesn't.
        if (ev.timestamp_ms) {
          sawDelta = true;
          return [{ type: "text", text, delta: true }];
        }
        return sawDelta ? [] : [{ type: "text", text, delta: false }];
      }
      case "tool_call": {
        const [kind, call] = Object.entries(ev.tool_call ?? {}).find(([k]) => k.endsWith("ToolCall")) ?? [];
        if (!kind || kind === "getMcpToolsToolCall") return []; // tool discovery, like ToolSearch
        const c = call as CursorToolCall;
        const name =
          kind === "mcpToolCall"
            ? `mcp__${c.args?.providerIdentifier ?? c.args?.serverIdentifier}__${c.args?.toolName}`
            : kind.replace(/ToolCall$/, "").replace(/^./, (x) => x.toUpperCase());
        if (ev.subtype === "started")
          return [{ type: "tool", id: ev.call_id, name, input: kind === "mcpToolCall" ? c.args?.args : c.args }];
        const r = c.result ?? {};
        if (r.success)
          return [
            {
              type: "tool_result",
              id: ev.call_id,
              isError: false,
              raw: texts(r.success.content ?? r.success.stdout ?? r.success),
            },
          ];
        return [
          {
            type: "tool_result",
            id: ev.call_id,
            isError: true,
            raw: texts(r.rejected?.reason ?? r.error?.message ?? r.failure ?? "failed"),
          },
        ];
      }
      case "result": {
        const u = ev.usage ?? {};
        return [
          {
            type: "usage",
            tokens: (u.inputTokens ?? 0) + (u.outputTokens ?? 0) + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0),
          },
          ...(ev.is_error ? [{ type: "error" as const, message: String(ev.result ?? ev.subtype) }] : []),
        ];
      }
    }
    return [];
  };
}
