// A reply's timeline (text and tool calls, in order, with status and timing) and the cards the UI
// shows for MeatDeck/Slack tool results.
import type { ChatArtifact, ChatMessage, WorkEntry } from "../../shared/types.ts";
import { toolHint } from "../claude/streamEvents.ts";

const now = () => new Date().toISOString();

export function addText(reply: ChatMessage, text: string) {
  const parts = (reply.parts ??= []);
  const last = parts.at(-1);
  if (last?.kind === "text") last.text += text;
  else parts.push({ kind: "text", text });
}
export function startTool(reply: ChatMessage, toolId: string, tool: string, input: unknown) {
  const parts = (reply.parts ??= []);
  const entry: WorkEntry = {
    id: toolId,
    tool,
    detail: toolHint(input).trim() || undefined,
    status: "running",
    at: now(),
  };
  const last = parts.at(-1);
  if (last?.kind === "work") last.entries.push(entry);
  else parts.push({ kind: "work", entries: [entry] });
}
export function endTool(reply: ChatMessage, toolId: string, isError: boolean, raw: string) {
  for (const p of reply.parts ?? [])
    if (p.kind === "work")
      for (const e of p.entries)
        if (e.id === toolId)
          Object.assign(e, {
            status: isError ? "error" : "done",
            endedAt: now(),
            ...(isError ? { error: raw.slice(0, 300) } : {}),
          });
}
/** When the turn ends, nothing is still running. */
export function settleTools(reply: ChatMessage) {
  for (const p of reply.parts ?? [])
    if (p.kind === "work")
      for (const e of p.entries)
        if (e.status === "running")
          Object.assign(e, { status: reply.status === "failed" ? "error" : "done", endedAt: now() });
  reply.finishedAt = now();
}

/** The fields artifactOf reads from a tool call's input and its JSON result. */
interface ToolInput {
  title?: string;
  todos?: { title: string }[];
  messages?: { to: string }[];
  channel_id?: string;
  message?: string;
  text?: string;
}
interface ToolOutput {
  id?: string;
  title?: string;
  ids?: string[];
}

/** Turn MeatDeck/Slack tool results into cards the UI can open. */
export function artifactOf(name: string, rawInput: unknown, raw: string): ChatArtifact | undefined {
  const input = rawInput as ToolInput | undefined;
  let out: ToolOutput | undefined;
  try {
    out = JSON.parse(raw);
  } catch {
    out = undefined;
  }
  switch (name) {
    case "mcp__meatdeck__create_doc":
      return out?.id ? { kind: "note", id: out.id, title: input?.title || "Untitled", created: true } : undefined;
    case "mcp__meatdeck__update_doc":
    case "mcp__meatdeck__append_to_doc":
      return out?.id
        ? { kind: "note", id: out.id, title: out.title || input?.title || "Doc", created: false }
        : undefined;
    case "mcp__meatdeck__add_todos":
      return out?.ids?.length
        ? { kind: "todos", ids: out.ids, titles: (input?.todos ?? []).map((t) => t.title) }
        : undefined;
    case "mcp__meatdeck__draft_messages":
      return out?.ids?.length
        ? { kind: "drafts", ids: out.ids, to: (input?.messages ?? []).map((m) => m.to) }
        : undefined;
    case "mcp__claude_ai_Slack__slack_send_message":
      return {
        kind: "sent",
        to: input?.channel_id ?? "Slack",
        channel: "slack",
        text: String(input?.message ?? input?.text ?? "").slice(0, 300),
      };
    default:
      return undefined;
  }
}
