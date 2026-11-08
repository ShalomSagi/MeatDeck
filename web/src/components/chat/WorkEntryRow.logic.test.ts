import { describe, expect, it } from "vitest";
import type { WorkEntry } from "../../../../shared/types.ts";
import { presentEntry } from "./WorkEntryRow.logic.ts";

const entry = (tool: string, status: WorkEntry["status"] = "done", detail?: string): WorkEntry => ({
  id: "1",
  tool,
  status,
  at: "2026-11-08T10:00:00.000Z",
  detail,
});

describe("presentEntry", () => {
  it.each([
    // Claude Code, Codex and Cursor names for the same kind of tool
    ["Bash", "done", { action: "command", icon: "terminal", label: "Ran command" }],
    ["exec_command", "running", { action: "command", icon: "terminal", label: "Running command" }],
    ["run_terminal_cmd", "error", { action: "command", icon: "terminal", label: "Command failed" }],
    ["Read", "done", { action: "read", icon: "eye", label: "Read file" }],
    ["apply_patch", "done", { action: "edit", icon: "square-pen", label: "Edited file" }],
    ["Grep", "done", { action: "code-search", icon: "search", label: "Searched code" }],
    ["WebSearch", "done", { action: "search", icon: "globe", label: "Searched the web" }],
    ["WebFetch", "error", { action: "fetch", icon: "globe", label: "Failed to fetch page" }],
    ["Task", "done", { action: "agent", icon: "bot", label: "Ran agent" }],
    ["TodoWrite", "done", { action: "todo", icon: "list-todo", label: "Updated todos" }],
    // MCP tools: server name cleaned up, known servers get their real names
    [
      "mcp__claude_ai_Slack__slack_search_public",
      "done",
      { action: "mcp", icon: "hammer", label: "Slack · slack_search_public", source: "Slack" },
    ],
    [
      "mcp__meatdeck__get_day",
      "done",
      { action: "mcp", icon: "hammer", label: "MeatDeck · get_day", source: "MeatDeck" },
    ],
    ["mcp__t3-code__t3_thread_read", "done", { action: "mcp", label: "T3 Code · t3_thread_read", source: "T3 Code" }],
    ["mcp__linear_server", "done", { action: "mcp", label: "Linear server", source: "Linear server" }],
    // anything else keeps its own name
    ["Skill", "done", { action: "other", icon: "zap", label: "Skill" }],
    ["some_new_tool", "done", { action: "other", icon: "wrench", label: "some new tool" }],
  ] as const)("%s (%s)", (tool, status, want) => {
    expect(presentEntry(entry(tool, status))).toMatchObject(want);
  });

  it.each([
    ["  ls -la  ", "ls -la"],
    ["   ", undefined],
    [undefined, undefined],
  ])("detail %j → %j", (detail, want) => {
    expect(presentEntry(entry("Bash", "done", detail)).detail).toBe(want);
  });
});
