// A chat turn on Codex or Cursor: same reply shape, provider-specific CLI and stream
// (server/providers/: turnCommand/turnParser).
import { spawn } from "node:child_process";
import { PROVIDER_LABEL, type ProviderId } from "../../shared/providers.ts";
import type { Chat, ChatMessage, ContextRef } from "../../shared/types.ts";
import { runEnv } from "../claude/allowlists.ts";
import type { AgentEvent } from "../providers/agentTurn.ts";
import { turnCommand, turnParser } from "../providers/registry.ts";
import { DATA_DIR } from "../store/persistence.ts";
import { chatEvents, persist, running } from "./chatStore.ts";
import { contextText } from "./pageContext.ts";
import { systemPrompt } from "./prompts.ts";
import { addText, artifactOf, endTool, settleTools, startTool } from "./replyParts.ts";

const now = () => new Date().toISOString();

/** A chat turn on Codex or Cursor: same reply shape, provider-specific CLI and stream (server/providers/). */
export function runOther(
  provider: Exclude<ProviderId, "claude">,
  chat: Chat,
  reply: ChatMessage,
  prompt: string,
  refs: ContextRef[],
  added: ContextRef[],
) {
  const resume = chat.sessionId;
  // Instructions (with everything attached so far) ride in the first prompt, since neither CLI has
  // --append-system-prompt; the session keeps them, so later turns only add newly attached things.
  const full = resume
    ? `${contextText(added).trim() ? `${contextText(added).trim()}\n\n` : ""}${prompt}`
    : `<instructions>\n${systemPrompt(refs, provider)}\n</instructions>\n\n${prompt}`;
  const { bin, args } = turnCommand(provider, {
    prompt: full,
    model: chat.model,
    effort: chat.effort,
    resume,
    mcpEnv: { MEATDECK_RUN: `chat: ${chat.title}`, MEATDECK_CHAT: chat.id, MEATDECK_WRITE: "1" },
  });
  const child = spawn(bin, args, {
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
  let error = "";
  const parse = turnParser(provider);

  const handle = (ev: AgentEvent) => {
    switch (ev.type) {
      case "session":
        chat.sessionId = ev.id;
        chat.sessionProvider = provider;
        break;
      case "text":
        if (!textSinceTool && reply.text && !reply.text.endsWith("\n\n")) reply.text += "\n\n";
        textSinceTool = true;
        reply.text += ev.text;
        addText(reply, ev.text);
        break;
      case "tool":
        tools.set(ev.id, { name: ev.name, input: ev.input });
        startTool(reply, ev.id, ev.name, ev.input);
        textSinceTool = false;
        break;
      case "tool_result": {
        const call = tools.get(ev.id);
        endTool(reply, ev.id, ev.isError, ev.raw);
        if (!ev.isError && call) {
          const artifact = artifactOf(call.name, call.input, ev.raw);
          if (artifact) reply.artifacts!.push(artifact);
        }
        break;
      }
      case "usage":
        reply.usage = { tokens: (reply.usage?.tokens ?? 0) + ev.tokens };
        break;
      case "error":
        error = ev.message;
        break;
    }
    push();
  };

  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.trim()) parse(line).forEach(handle);
    }
  });
  child.stderr.on("data", (c: Buffer) => (stderr = (stderr + c.toString()).slice(-4000)));
  child.on("error", (err) => (error = err.message));
  child.on("close", (code, signal) => {
    running.delete(chat.id);
    // Codex also emits non-fatal "error" events (reconnecting…), so the exit code decides.
    reply.status = signal ? "stopped" : code === 0 ? "done" : "failed";
    settleTools(reply);
    if (reply.status === "failed" && !reply.text) {
      const detail =
        error ||
        stderr
          .split("\n")
          .filter((l) => l.trim() && !/rmcp::transport|AuthRequired/.test(l))
          .slice(-8)
          .join("\n");
      reply.text = `${PROVIDER_LABEL[provider]} exited with an error.\n\n\`\`\`\n${detail.trim().slice(-600)}\n\`\`\``;
      addText(reply, reply.text);
    }
    chat.updatedAt = now();
    persist();
    clearTimeout(pending);
    chatEvents.emit("chat", chat);
    chatEvents.emit("list");
    chatEvents.emit("finished", chat);
  });
  push();
}
