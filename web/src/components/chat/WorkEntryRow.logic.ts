/*
 * Tool presentation: raw tool names → action, icon and label.
 *
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineWorkEntryRow.logic.ts
 *   apps/web/src/components/chat/TimelineToolActivityIcon.tsx (icon names)
 *   packages/client-runtime/src/work-log/presentation.ts
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import type { WorkEntry } from "../../../../shared/types.ts";

export type IconName =
  | "terminal"
  | "eye"
  | "square-pen"
  | "search"
  | "globe"
  | "bot"
  | "list-todo"
  | "zap"
  | "wrench"
  | "hammer"
  | "brain";
export type ToolAction =
  | "command"
  | "read"
  | "edit"
  | "code-search"
  | "search"
  | "fetch"
  | "agent"
  | "todo"
  | "mcp"
  | "other";

const ACTION_ICON: Record<ToolAction, IconName> = {
  command: "terminal",
  read: "eye",
  edit: "square-pen",
  "code-search": "search",
  search: "globe",
  fetch: "globe",
  agent: "bot",
  todo: "list-todo",
  mcp: "hammer",
  other: "wrench",
};

/** Raw tool names from Claude Code, Codex and Cursor → T3's tool-group actions. */
function toolAction(tool: string): ToolAction {
  if (tool.startsWith("mcp__")) return "mcp";
  const t = tool.toLowerCase().replace(/[\s_-]/g, "");
  if (
    [
      "bash",
      "shell",
      "execcommand",
      "command",
      "localshell",
      "terminal",
      "runterminalcmd",
      "bashoutput",
      "killshell",
    ].includes(t)
  )
    return "command";
  if (["read", "readfile", "view", "notebookread", "readlints"].includes(t)) return "read";
  if (
    [
      "edit",
      "write",
      "multiedit",
      "notebookedit",
      "applypatch",
      "strreplace",
      "editfile",
      "writefile",
      "delete",
      "deletefile",
      "searchreplace",
    ].includes(t)
  )
    return "edit";
  if (
    [
      "grep",
      "glob",
      "ls",
      "listdir",
      "find",
      "search",
      "codebasesearch",
      "filesearch",
      "globfilesearch",
      "greptool",
    ].includes(t)
  )
    return "code-search";
  if (["websearch", "websearchcall"].includes(t)) return "search";
  if (["webfetch", "fetch", "fetchurl"].includes(t)) return "fetch";
  if (["task", "agent", "subagent", "spawnagent"].includes(t)) return "agent";
  if (["todowrite", "updateplan", "todo", "todos"].includes(t)) return "todo";
  return "other";
}

const MCP_SERVER_NAMES: Record<string, string> = { meatdeck: "MeatDeck", "t3-code": "T3 Code" };

/** "mcp__claude_ai_Slack__slack_search_public" → { server: "Slack", tool: "slack_search_public" }. */
function mcpParts(tool: string): { server: string; tool: string } {
  const rest = tool.replace(/^mcp__claude_ai_/, "").replace(/^mcp__/, "");
  const [server = rest, ...name] = rest.split("__");
  const pretty =
    MCP_SERVER_NAMES[server.toLowerCase()] ?? server.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { server: pretty, tool: name.join(" · ") };
}

/** Same cleanup as the old step lines: strip the mcp prefixes, "__" → " · ". */
function shortTool(tool: string): string {
  if (!tool.startsWith("mcp__")) return tool;
  const { server, tool: name } = mcpParts(tool);
  return name ? `${server} · ${name}` : server;
}

const VERBS: Record<Exclude<ToolAction, "mcp" | "other">, [running: string, done: string, failed: string]> = {
  command: ["Running command", "Ran command", "Command failed"],
  read: ["Reading file", "Read file", "Failed to read file"],
  edit: ["Editing file", "Edited file", "Failed to edit file"],
  "code-search": ["Searching code", "Searched code", "Code search failed"],
  search: ["Searching the web", "Searched the web", "Web search failed"],
  fetch: ["Fetching page", "Fetched page", "Failed to fetch page"],
  agent: ["Running agent", "Ran agent", "Agent failed"],
  todo: ["Updating todos", "Updated todos", "Failed to update todos"],
};

export interface EntryPresentation {
  action: ToolAction;
  icon: IconName;
  label: string;
  detail?: string;
  /** Integration name for MCP tools ("Slack"), used by the group summary. */
  source?: string;
}

export function presentEntry(e: WorkEntry): EntryPresentation {
  const action = toolAction(e.tool);
  const detail = e.detail?.trim() || undefined;
  if (action === "mcp") {
    const { server } = mcpParts(e.tool);
    return { action, icon: ACTION_ICON.mcp, label: shortTool(e.tool), detail, source: server };
  }
  if (action === "other") {
    const name = e.tool.replace(/_/g, " ");
    return { action, icon: e.tool === "Skill" ? "zap" : ACTION_ICON.other, label: name, detail };
  }
  const [running, done, failed] = VERBS[action];
  return {
    action,
    icon: ACTION_ICON[action],
    label: e.status === "running" ? running : e.status === "error" ? failed : done,
    detail,
  };
}
