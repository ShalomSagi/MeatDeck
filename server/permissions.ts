// When a Claude run reaches for a tool outside its allowlist, Claude Code asks our MCP tool
// (--permission-prompt-tool), which asks the user here instead of failing the session.
// The MCP tool polls /api/permissions/:id until the user decides (or it times out).
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { PermissionRequest } from "../shared/types.ts";

export const permissionEvents = new EventEmitter();
const pending = new Map<string, PermissionRequest>();
const decided = new Map<string, { behavior: "allow" | "deny"; message?: string; always?: boolean }>();

/** Tool inputs are whatever the model sent; only a few hint fields are read. */
type ToolInput = Record<string, unknown> | null | undefined;

function summarize(tool: string, input: unknown): string {
  const i = input as ToolInput;
  const nice = tool
    .replace(/^mcp__claude_ai_/, "")
    .replace(/^mcp__/, "")
    .replace(/__/g, " · ")
    .replace(/_/g, " ");
  const hint = i?.command ?? i?.query ?? i?.url ?? i?.title ?? i?.file_path ?? "";
  return hint ? `${nice} — ${String(hint).slice(0, 120)}` : nice;
}

export function requestPermission(input: {
  tool: string;
  input: unknown;
  chatId?: string;
  run?: string;
}): PermissionRequest {
  const req: PermissionRequest = {
    id: randomUUID().slice(0, 8),
    tool: input.tool,
    summary: summarize(input.tool, input.input),
    input: input.input,
    chatId: input.chatId,
    run: input.run,
    at: new Date().toISOString(),
  };
  pending.set(req.id, req);
  permissionEvents.emit("change", req);
  return req;
}

export function pendingPermissions(): PermissionRequest[] {
  return [...pending.values()];
}

export function permissionStatus(id: string) {
  const d = decided.get(id);
  if (d) return { status: d.behavior, message: d.message };
  return pending.has(id) ? { status: "pending" as const } : { status: "deny" as const, message: "Request expired." };
}

export function decide(id: string, decision: "allow" | "always" | "deny"): PermissionRequest | undefined {
  const req = pending.get(id);
  if (!req) return undefined;
  pending.delete(id);
  decided.set(
    id,
    decision === "deny"
      ? { behavior: "deny", message: "The user declined this." }
      : { behavior: "allow", always: decision === "always" },
  );
  setTimeout(() => decided.delete(id), 10 * 60_000);
  permissionEvents.emit("change", req);
  return req;
}

/** Give up on requests nobody answered (the MCP side stops waiting at the same time). */
export function expire(id: string) {
  if (pending.delete(id)) permissionEvents.emit("change");
}

/** What "Always allow" adds to the allowlist: a whole MCP server, or a Bash command prefix. */
export function allowRuleFor(tool: string, input: unknown): string {
  const command = (input as ToolInput)?.command;
  // mcp__claude_ai_Claude_Docs__batch → mcp__claude_ai_Claude_Docs (the whole server)
  if (tool.startsWith("mcp__")) return tool.lastIndexOf("__") > 4 ? tool.slice(0, tool.lastIndexOf("__")) : tool;
  if (tool === "Bash" && typeof command === "string") return `Bash(${command.trim().split(/\s+/)[0]}:*)`;
  return tool;
}
