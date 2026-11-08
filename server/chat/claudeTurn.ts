// A chat turn on Claude Code: one session per chat (`--session-id` on the first turn, `--resume`
// after), streamed live into the side panel. Fully capable by design (the user asked for it): it can
// read and write Slack, Linear, Notion and GitHub, and send messages when asked. Turns on other
// providers go to providerTurn.ts.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Chat, ChatMessage, ContextRef } from "../../shared/types.ts";
import { FILE_WRITES, permissionArgs, runEnv, withAlwaysAllowed } from "../claude/allowlists.ts";
import { recordLimits, toRunUsage, type StreamEvent } from "../claude/streamEvents.ts";
import { integrationServers } from "../integrations.ts";
import { resolveBin } from "../shellEnv.ts";
import { DATA_DIR } from "../store/persistence.ts";
import { chatEvents, persist, running } from "./chatStore.ts";
import { systemPrompt } from "./prompts.ts";
import { runOther } from "./providerTurn.ts";
import { addText, artifactOf, endTool, settleTools, startTool } from "./replyParts.ts";

const now = () => new Date().toISOString();

// ---------- tools ----------
// Whole servers: chat is meant to be fully capable (read, write, send) at the user's request.
const CHAT_BASE = [
  "mcp__meatdeck",
  "Bash(gh:*)",
  "Bash(git log:*)",
  "Bash(date:*)",
  "Read",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Skill",
  "ToolSearch",
];
/** Base tools plus every enabled integration's whole connector: chat is fully capable. */
const chatTools = () => [...CHAT_BASE, ...integrationServers()];

/** Earlier turns, for a new session after switching providers mid-chat (sessions don't carry over). */
function recap(chat: Chat): string {
  const earlier = chat.messages.slice(0, -2).slice(-8);
  if (!earlier.length) return "";
  return `Earlier in this chat (on another model):\n${earlier.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text.slice(0, 600)}`).join("\n")}\n\n`;
}

export function runTurn(
  chat: Chat,
  reply: ChatMessage,
  prompt: string,
  refs: ContextRef[],
  added: ContextRef[] = refs,
) {
  const provider = chat.provider ?? "claude";
  let carried = "";
  if (chat.sessionId && (chat.sessionProvider ?? "claude") !== provider) {
    carried = recap(chat);
    chat.sessionId = undefined;
  }
  if (provider !== "claude") return runOther(provider, chat, reply, carried + prompt, refs, added);
  if (carried) prompt = carried + prompt;
  chat.sessionProvider = "claude";
  const first = !chat.sessionId;
  if (first) chat.sessionId = randomUUID();
  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    chat.model,
    ...(chat.effort ? ["--effort", chat.effort] : []),
    ...(first ? ["--session-id", chat.sessionId!] : ["--resume", chat.sessionId!]),
    "--append-system-prompt",
    systemPrompt(refs),
    "--allowedTools",
    withAlwaysAllowed(chatTools()).join(","),
    // User content belongs in MeatDeck, not in files in the app's working directory.
    "--disallowedTools",
    FILE_WRITES.join(","),
    ...permissionArgs(),
  ];
  const child = spawn(resolveBin("claude"), args, {
    cwd: DATA_DIR,
    env: runEnv(`chat: ${chat.title}`, chat.id, true),
    stdio: ["ignore", "pipe", "pipe"],
  });
  running.set(chat.id, child);
  chatEvents.emit("list");

  let pending: ReturnType<typeof setTimeout> | undefined;
  const push = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = undefined;
      chatEvents.emit("chat", chat);
    }, 60);
  };
  const tools = new Map<string, { name: string; input: unknown }>();
  let textSinceTool = false;
  let stderr = "";

  const handle = (ev: StreamEvent) => {
    if (ev.type === "stream_event") {
      const e = ev.event;
      if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") {
        // A new paragraph after tool use reads better than gluing turns together.
        if (!textSinceTool && reply.text && !reply.text.endsWith("\n\n")) reply.text += "\n\n";
        textSinceTool = true;
        reply.text += e.delta.text;
        addText(reply, e.delta.text);
        push();
      }
    } else if (ev.type === "assistant") {
      for (const part of ev.message?.content ?? []) {
        if (part.type === "tool_use") {
          tools.set(part.id, { name: part.name, input: part.input });
          if (part.name !== "ToolSearch") startTool(reply, part.id, part.name, part.input);
          textSinceTool = false;
          push();
        }
      }
    } else if (ev.type === "user") {
      for (const part of ev.message?.content ?? []) {
        if (part.type !== "tool_result") continue;
        const call = tools.get(part.tool_use_id);
        if (!call) continue;
        const raw =
          typeof part.content === "string" ? part.content : (part.content ?? []).map((c) => c.text ?? "").join("");
        endTool(reply, part.tool_use_id, !!part.is_error, raw);
        if (!part.is_error) {
          const artifact = artifactOf(call.name, call.input, raw);
          if (artifact) reply.artifacts!.push(artifact);
        }
        push();
      }
    } else if (ev.type === "rate_limit_event") {
      recordLimits(ev.rate_limit_info);
    } else if (ev.type === "result") {
      const u = toRunUsage(ev);
      if (u) reply.usage = { tokens: u.total, costUsd: u.costUsd };
      if (ev.is_error && !reply.text) {
        reply.text = `Something went wrong: ${ev.result ?? ev.subtype}`;
        addText(reply, reply.text);
      }
    }
  };

  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      try {
        handle(JSON.parse(line));
      } catch {}
    }
  });
  child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
  child.on("close", (code, signal) => {
    running.delete(chat.id);
    reply.status = signal ? "stopped" : code === 0 ? "done" : "failed";
    settleTools(reply);
    if (reply.status === "failed" && !reply.text) {
      reply.text = `Claude exited with an error.\n\n\`\`\`\n${stderr.trim().slice(-600)}\n\`\`\``;
      addText(reply, reply.text);
    }
    chat.updatedAt = now();
    persist();
    clearTimeout(pending);
    chatEvents.emit("chat", chat);
    chatEvents.emit("list");
    chatEvents.emit("finished", chat); // lets usage rescan
  });
  push();
}
