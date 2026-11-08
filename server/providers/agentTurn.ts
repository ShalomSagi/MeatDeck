// What a chat turn looks like on any provider: the normalized event stream, the turn's input, and
// how a provider CLI launches MeatDeck's own MCP server.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** How to launch MeatDeck's own MCP server: next to the bundled server, or from source in dev. */
export function meatdeckMcp(): { command: string; args: string[]; env: Record<string, string> } {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = join(here, "mcp.mjs");
  if (existsSync(bundled)) return { command: process.execPath, args: [bundled], env: { ELECTRON_RUN_AS_NODE: "1" } };
  return { command: process.execPath, args: [join(here, "..", "..", "mcp", "index.ts")], env: {} };
}

/** One step of an agent turn, the same for every provider. */
export type AgentEvent =
  | { type: "session"; id: string }
  | { type: "text"; text: string; delta: boolean }
  | { type: "tool"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; isError: boolean; raw: string }
  | { type: "usage"; tokens: number; costUsd?: number }
  | { type: "error"; message: string };

export interface TurnInput {
  prompt: string;
  model: string;
  effort?: string;
  /** The provider's own session/thread id to continue. */
  resume?: string;
  /** Extra env for the MeatDeck MCP (MEATDECK_CHAT, MEATDECK_RUN, MEATDECK_WRITE). */
  mcpEnv: Record<string, string>;
}

export function texts(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(texts).join("");
  if (!v || typeof v !== "object") return "";
  const o = v as { text?: unknown; content?: unknown };
  return typeof o.text === "string" ? o.text : texts(o.text ?? o.content ?? "");
}
