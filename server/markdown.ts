// Markdown → the note editor's document (Tiptap/ProseMirror JSON). Plain code, so Claude can
// create real notes (headings, lists, "- [ ]" checkboxes that become todos) by writing Markdown.
import { randomUUID } from "node:crypto";

type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** Inline: **bold**, *italic*, `code`, [text](url), bare URLs. */
function inline(text: string): Node[] {
  const out: Node[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(<?([^)>\s]+)>?\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string, marks?: Node["marks"]) =>
    t && out.push(marks ? { type: "text", text: t, marks } : { type: "text", text: t });
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[1]) push(m[1], [{ type: "bold" }]);
    else if (m[2]) push(m[2], [{ type: "italic" }]);
    else if (m[3]) push(m[3], [{ type: "code" }]);
    else if (m[4]) push(m[4], [{ type: "link", attrs: { href: m[5] } }]);
    else if (m[6]) push(m[6], [{ type: "link", attrs: { href: m[6] } }]);
    last = m.index + m[0].length;
  }
  push(text.slice(last));
  return out;
}

const para = (t: string): Node => (t.trim() ? { type: "paragraph", content: inline(t.trim()) } : { type: "paragraph" });

export function markdownToDoc(md: string): Node {
  const content: Node[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      content.push({ type: "heading", attrs: { level: h[1].length }, content: inline(h[2]) });
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      content.push({ type: "codeBlock", content: body.length ? [{ type: "text", text: body.join("\n") }] : [] });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      content.push({ type: "blockquote", content: [para(body.join(" "))] });
      continue;
    }
    // Lists: tasks, bullets, numbered. Consecutive lines of the same kind form one list.
    // Tasks: "- [ ]" is the format, but agents also write "1. [ ]", "* [x]", "+ [ ]" or a bare "[ ]";
    // all of them are checkboxes (an ordered checklist keeps its order, just not the numbers).
    const task = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?\[( |x|X)\]\s+(.*)$/;
    const bullet = /^\s*[-*]\s+(.*)$/;
    const num = /^\s*\d+[.)]\s+(.*)$/;
    if (task.test(line)) {
      const items: Node[] = [];
      while (i < lines.length && task.test(lines[i])) {
        const m = task.exec(lines[i++])!;
        items.push({
          type: "taskItem",
          attrs: { checked: m[1].toLowerCase() === "x", id: randomUUID().slice(0, 8) },
          content: [para(m[2])],
        });
      }
      content.push({ type: "taskList", content: items });
      continue;
    }
    if (bullet.test(line) || num.test(line)) {
      const ordered = num.test(line) && !bullet.test(line);
      const re = ordered ? num : bullet;
      const items: Node[] = [];
      while (i < lines.length && re.test(lines[i]) && !task.test(lines[i])) {
        items.push({ type: "listItem", content: [para(re.exec(lines[i++])![1])] });
      }
      content.push({ type: ordered ? "orderedList" : "bulletList", content: items });
      continue;
    }
    // Paragraph: join wrapped lines until a blank line or another block starts.
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s|\s*\[[ xX]\]\s)/.test(lines[i])
    )
      body.push(lines[i++]);
    if (!body.length) body.push(lines[i++]);
    content.push(para(body.join(" ")));
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** Append Markdown to an existing doc. */
export function appendMarkdown(doc: unknown, md: string): Node {
  const base = (doc as Node) ?? { type: "doc", content: [] };
  const extra = markdownToDoc(md).content ?? [];
  return {
    ...base,
    content: [...(base.content ?? []).filter((n) => !(n.type === "paragraph" && !n.content?.length)), ...extra],
  };
}

const BOX = /^\s*\[( |x|X)\]\s+/;
const firstText = (item: Node): Node | undefined => item.content?.[0]?.content?.[0];

/**
 * A bulleted or numbered list whose every item starts with "[ ]"/"[x]" (an agent wrote "1. [ ] …",
 * or the editor kept the brackets as text) becomes a real checklist, so its items become todos.
 */
export function normalizeTasks(doc: unknown): Node {
  const fix = (n: Node): Node => {
    const content = n.content?.map(fix);
    if (
      (n.type === "orderedList" || n.type === "bulletList") &&
      content?.length &&
      content.every((it) => it.type === "listItem" && BOX.test(firstText(it)?.text ?? ""))
    ) {
      return {
        type: "taskList",
        content: content.map((it) => {
          const t = firstText(it)!;
          const checked = BOX.exec(t.text!)![1].toLowerCase() === "x";
          const rest = t.text!.replace(BOX, "");
          const [p, ...more] = it.content!;
          const kept = [...(rest ? [{ ...t, text: rest }] : []), ...(p.content ?? []).slice(1)];
          return {
            type: "taskItem",
            attrs: { checked, id: randomUUID().slice(0, 8) },
            content: [{ ...p, content: kept }, ...more],
          };
        }),
      };
    }
    return content ? { ...n, content } : n;
  };
  return fix((doc as Node) ?? { type: "doc", content: [] });
}
