// Reading Claude Code's stream-json output: a short readable log for runs, per-run usage, and the
// Claude limit windows (rate_limit_event), all from the stream we already parse. No extra calls.
import type { RunUsage, UsageLimits } from "../../shared/types.ts";
import { store } from "../store/store.ts";

/** The parts of Claude Code's stream-json output MeatDeck reads (runs in runQueue.ts, chats in chat/claudeTurn.ts). */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input?: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: string | { text?: string }[]; is_error?: boolean };
interface ModelUsage {
  inputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  outputTokens?: number;
}
export interface StreamEvent {
  type?: string;
  subtype?: string;
  event?: {
    type?: string;
    delta?: { type: "text_delta"; text: string } | { type: "input_json_delta" | "thinking_delta" | "signature_delta" };
  };
  message?: { content?: ContentPart[] };
  rate_limit_info?: unknown;
  result?: string;
  is_error?: boolean;
  session_id?: string;
  total_cost_usd?: number;
  modelUsage?: Record<string, ModelUsage>;
}
interface RateLimitInfo {
  unifiedWindows?: Record<string, { utilization?: number; resetsAt?: number }>;
  overageStatus?: string;
  isUsingOverage?: boolean;
}

export function tryJson(line: string): StreamEvent | undefined {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

export function toRunUsage(ev: StreamEvent | undefined, sessionId?: string): RunUsage | undefined {
  // modelUsage covers every model the run touched (incl. Claude Code's own small-model side calls).
  const models = ev?.modelUsage;
  if (!models) return undefined;
  const t = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  for (const m of Object.values(models)) {
    t.input += m.inputTokens ?? 0;
    t.cacheWrite += m.cacheCreationInputTokens ?? 0;
    t.cacheRead += m.cacheReadInputTokens ?? 0;
    t.output += m.outputTokens ?? 0;
  }
  return {
    ...t,
    total: t.input + t.cacheWrite + t.cacheRead + t.output,
    costUsd: typeof ev.total_cost_usd === "number" ? ev.total_cost_usd : undefined,
    models: Object.keys(models),
    sessionId: ev.session_id ?? sessionId,
  };
}

const WINDOW_META = {
  five_hour: { label: "Session · 5h", minutes: 5 * 60 },
  seven_day: { label: "Weekly", minutes: 7 * 24 * 60 },
} as const;

export function recordLimits(raw: unknown) {
  const info = raw as RateLimitInfo | undefined;
  const unified = info?.unifiedWindows;
  if (!info || !unified) return;
  const windows: UsageLimits["windows"] = [];
  for (const id of ["five_hour", "seven_day"] as const) {
    const w = unified[id];
    if (typeof w?.utilization !== "number") continue;
    windows.push({
      id,
      ...WINDOW_META[id],
      usedPercent: Math.round(w.utilization * 1000) / 10,
      resetsAt: w.resetsAt ? new Date(w.resetsAt * 1000).toISOString() : undefined,
    });
  }
  if (!windows.length) return;
  store.setLimits({
    at: new Date().toISOString(),
    windows,
    overage: info.overageStatus ? { status: info.overageStatus, usingOverage: !!info.isUsingOverage } : undefined,
  });
}

/** Turn stream-json events into a short readable log; returns assistant text, if any. */
export function describeEvent(line: string, append: (s: string) => void): string | undefined {
  let ev: StreamEvent;
  try {
    ev = JSON.parse(line);
  } catch {
    append(line);
    return;
  }
  let text: string | undefined;
  if (ev.type === "assistant") {
    for (const part of ev.message?.content ?? []) {
      if (part.type === "text" && part.text.trim()) {
        text = part.text.trim();
        append(text);
      }
      if (part.type === "tool_use") append(`→ ${shortTool(part.name)}${toolHint(part.input)}`);
    }
  } else if (ev.type === "user") {
    for (const part of ev.message?.content ?? []) {
      if (part.type === "tool_result" && part.is_error) {
        const msg = typeof part.content === "string" ? part.content : JSON.stringify(part.content);
        append(`  ✗ ${msg.slice(0, 200)}`);
      }
    }
  } else if (ev.type === "result" && ev.is_error) {
    append(`error: ${ev.result ?? ev.subtype}`);
  }
  return text;
}

function shortTool(name: string) {
  return name
    .replace(/^mcp__claude_ai_/, "")
    .replace(/^mcp__/, "")
    .replace(/__/g, " · ");
}

export function toolHint(input: unknown): string {
  if (!input) return "";
  const i = input as Record<string, unknown>;
  const hint = i.command ?? i.query ?? i.skill ?? i.channel_id ?? i.id ?? "";
  return hint ? `  ${String(hint).slice(0, 80)}` : "";
}
