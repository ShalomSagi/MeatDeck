import { describe, expect, it } from "vitest";
import type { WorkEntry } from "../../../../shared/types.ts";
import { summarizeGroup } from "./TimelineWorkGroup.logic.ts";
import { presentEntry } from "./WorkEntryRow.logic.ts";

const group = (...tools: string[]) =>
  tools.map((tool, i) =>
    presentEntry({ id: `${i}`, tool, status: "done", at: "2026-11-08T10:00:00.000Z" } as WorkEntry),
  );

describe("summarizeGroup", () => {
  it.each([
    [["Bash", "Bash"], "Ran 2 commands", "terminal"],
    [["Read", "Bash"], "Read 1 file and ran 1 command", "hammer"],
    [["TodoWrite", "TodoWrite", "TodoWrite"], "Updated todos 3 times", "list-todo"],
    // commands and edits outrank the rest; the others are counted, not named
    [["Read", "Grep", "Edit", "Bash"], "Changed 1 file, ran 1 command, and performed 2 other actions", "hammer"],
    [
      ["mcp__claude_ai_Slack__a", "mcp__claude_ai_Slack__b", "Bash"],
      "Used Slack integration and ran 1 command",
      "hammer",
    ],
    [
      ["mcp__claude_ai_Slack__a", "mcp__claude_ai_Linear__b", "mcp__claude_ai_Notion__c"],
      "Used Slack, Linear, and Notion integrations",
      "hammer",
    ],
    [["mcp__claude_ai_Slack__a", "mcp__claude_ai_Linear__b"], "Used Slack and Linear integrations", "hammer"],
    [["Read", "Skill", "Grep"], "Read 1 file, searched code 1 time, and performed 1 other action", "hammer"],
  ])("%j", (tools, summary, icon) => {
    expect(summarizeGroup(group(...tools))).toEqual({ summary, icon });
  });
});
