// Tool allowlists for MeatDeck's Claude runs, the tools the user chose "Always allow" for, and the
// environment every run gets (which chat/run is asking, whether it may write).
import { integrationTools } from "../integrations.ts";
import { store } from "../store/store.ts";

// ---------- tool allowlists ----------
// `claude -p` denies any tool not listed, so these lists ARE the safety boundary.

// Service tools come from the enabled integrations (Settings → Integrations), not hardcoded here.
// PR status comes pre-computed in the digest; Claude only needs gh to read comment text.
const GITHUB_READ = ["Bash(gh pr view:*)", "Bash(gh api:*)", "Bash(gh issue view:*)"];

export const DASHBOARD = ["mcp__meatdeck"];
const BASICS = ["Read", "Skill", "ToolSearch"];

/** Scheduled and button runs: read-only tools of every enabled integration. */
export const readOnly = () => [...DASHBOARD, ...BASICS, ...GITHUB_READ, ...integrationTools("read")];

/** Sending (only ever started by a click on a specific message): the integrations' write tools. */
export const sendTools = () => [...DASHBOARD, "ToolSearch", ...integrationTools("write"), ...integrationTools("read")];

// Discovery needs search (to find related PRs/tickets by topic), so it gets gh search on top of read-only.
export const projectDiscovery = () => [...readOnly(), "Bash(gh search:*)", "Bash(gh pr list:*)"];

/** Tools that write files on disk: never allowed in MeatDeck's runs (content goes into MeatDeck). */
export const FILE_WRITES = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

/** Tools the user chose "Always allow" for. */
export function withAlwaysAllowed(tools: string[]): string[] {
  const always = (store.settings().alwaysAllowTools ?? []).filter((t) => !FILE_WRITES.includes(t));
  return [...new Set([...tools, ...always])];
}

/** Ask the user (in the app) for tools outside the allowlist, instead of the run failing. */
export function permissionArgs(): string[] {
  return ["--permission-prompt-tool", "mcp__meatdeck__approve_permission"];
}

/** Lets the MCP permission tool say which chat/run is asking; MCP calls may wait up to 15 min for you. */
export function runEnv(label: string, chatId?: string, allowWrite = false): NodeJS.ProcessEnv {
  return {
    ...process.env,
    MEATDECK_RUN: label,
    ...(chatId ? { MEATDECK_CHAT: chatId } : {}),
    // run_integration_action may only perform write actions (send, merge…) in runs allowed to write.
    ...(allowWrite ? { MEATDECK_WRITE: "1" } : {}),
    MCP_TOOL_TIMEOUT: "960000",
  };
}
