import { describe, expect, it } from "vitest";
import { markdownToDoc, normalizeTasks } from "./markdown.ts";

const types = (md: string) => markdownToDoc(md).content?.map((n) => n.type);
const tasks = (doc: ReturnType<typeof markdownToDoc>) =>
  doc.content
    ?.filter((n) => n.type === "taskList")
    .flatMap((l) => l.content ?? [])
    .map((item) => [item.attrs?.checked, item.content?.[0]?.content?.[0]?.text]);

describe("markdownToDoc", () => {
  it("parses the block types agents write", () => {
    expect(types("# Title\n\npara\nwrapped\n\n- a\n- b\n\n1. one\n\n> quote\n\n---\n\n```\ncode\n```")).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "blockquote",
      "horizontalRule",
      "codeBlock",
    ]);
  });

  it("turns every checkbox spelling into one checklist", () => {
    const doc = markdownToDoc("- [ ] a\n1. [x] b\n* [X] c\n[ ] d");
    expect(types("- [ ] a\n1. [x] b\n* [X] c\n[ ] d")).toEqual(["taskList"]);
    expect(tasks(doc)).toEqual([
      [false, "a"],
      [true, "b"],
      [true, "c"],
      [false, "d"],
    ]);
  });

  it("returns an editable empty doc for empty input", () => {
    expect(markdownToDoc("  \n")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("normalizeTasks", () => {
  const list = (type: string, items: string[]) => ({
    type: "doc",
    content: [
      {
        type,
        content: items.map((t) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
        })),
      },
    ],
  });

  it("converts a list whose items all start with a box", () => {
    expect(tasks(normalizeTasks(list("orderedList", ["[ ] a", "[x] b"])))).toEqual([
      [false, "a"],
      [true, "b"],
    ]);
  });

  it("keeps a list where only some items have a box", () => {
    expect(normalizeTasks(list("bulletList", ["[ ] a", "b"])).content?.[0].type).toBe("bulletList");
  });
});
