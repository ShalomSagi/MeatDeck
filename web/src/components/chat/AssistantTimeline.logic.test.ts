import { describe, expect, it } from "vitest";
import type { ChatMessage, ReplyPart } from "../../../../shared/types.ts";
import { assistantCopyText, legacyParts, partKeys } from "./AssistantTimeline.logic.ts";

const work = (...ids: string[]): ReplyPart => ({
  kind: "work",
  entries: ids.map((id) => ({ id, tool: "Bash", status: "done", at: "" })),
});
const text = (t: string): ReplyPart => ({ kind: "text", text: t });

describe("partKeys", () => {
  it.each([
    [[text("a")], ["t:start"]],
    [
      [text("a"), work("e1", "e2"), text("b")],
      ["t:start", "w:e1", "t:e1"],
    ],
    // a streaming reply keeps the keys it already had as parts are appended
    [
      [text("a"), work("e1"), text("b"), work("e3"), text("c")],
      ["t:start", "w:e1", "t:e1", "w:e3", "t:e3"],
    ],
  ])("%#", (parts, want) => {
    expect(partKeys(parts)).toEqual(want);
  });
});

describe("assistantCopyText", () => {
  it.each([
    [{ text: "plain" }, "plain"],
    [{ text: "ignored", parts: [text(" one "), work("e1"), text("  "), text("two")] }, "one\n\ntwo"],
  ])("%#", (m, want) => {
    expect(assistantCopyText(m as ChatMessage)).toBe(want);
  });
});

describe("legacyParts", () => {
  it("turns flat step strings into one work group before the text", () => {
    const m = {
      text: "Done.",
      status: "running",
      at: "2026-11-08T10:00:00.000Z",
      steps: ["Notion · search  cutover", "Bash"],
    } as ChatMessage;
    const { parts, presentations } = legacyParts(m);
    expect(parts).toEqual([
      {
        kind: "work",
        entries: [
          { id: "step-0", tool: "Notion · search  cutover", status: "done", at: m.at },
          // the last step of a running reply is the one still going
          { id: "step-1", tool: "Bash", status: "running", at: m.at },
        ],
      },
      { kind: "text", text: "Done." },
    ]);
    expect(presentations).toEqual([
      { action: "other", icon: "wrench", label: "Notion · search", detail: "cutover" },
      { action: "other", icon: "wrench", label: "Bash", detail: undefined },
    ]);
  });

  it("has no parts for an empty reply", () => {
    expect(legacyParts({ text: "", at: "" } as ChatMessage)).toEqual({ parts: [], presentations: undefined });
  });
});
