// Notes, the deterministic part (no tokens): walk the editor doc, turn checkboxes into todos,
// parse "@tomorrow"-style due dates, and render plain text for Claude and search.
// Claude only gets involved for judgment: implicit actions, check-ups and follow-ups.
import { randomUUID } from "node:crypto";
import { localeDayFirst } from "./locale.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
}

export interface NoteTask {
  id: string;
  checked: boolean;
  text: string;
  due?: string;
}

const textOf = (n: PMNode): string =>
  (n.text ?? "") + (n.content ?? []).map(textOf).join(n.type === "paragraph" ? "" : "");

/** Plain-text rendering: headings as "#", bullets as "-", tasks as "[ ]"/"[x]". Compact, for Claude. */
export function renderText(doc: unknown): string {
  const lines: string[] = [];
  const walk = (n: PMNode, depth: number, listMark?: string) => {
    switch (n.type) {
      case "heading":
        lines.push(`${"#".repeat(Number(n.attrs?.level ?? 1))} ${textOf(n)}`);
        return;
      case "paragraph": {
        const t = textOf(n);
        if (t.trim()) lines.push(`${"  ".repeat(depth)}${listMark ? `${listMark} ` : ""}${t}`);
        return;
      }
      case "taskItem": {
        const [first, ...rest] = n.content ?? [];
        lines.push(`${"  ".repeat(depth)}[${n.attrs?.checked ? "x" : " "}] ${first ? textOf(first) : ""}`);
        for (const c of rest) walk(c, depth + 1);
        return;
      }
      case "listItem": {
        const [first, ...rest] = n.content ?? [];
        if (first) walk(first, depth, listMark ?? "-");
        for (const c of rest) walk(c, depth + 1);
        return;
      }
      case "bulletList":
      case "orderedList":
      case "taskList":
        (n.content ?? []).forEach((c, i) => walk(c, depth, n.type === "orderedList" ? `${i + 1}.` : "-"));
        return;
      case "blockquote":
        (n.content ?? []).forEach((c) => walk(c, depth, ">"));
        return;
      case "codeBlock":
        lines.push("```", textOf(n), "```");
        return;
      case "horizontalRule":
        lines.push("---");
        return;
      default:
        (n.content ?? []).forEach((c) => walk(c, depth, listMark));
    }
  };
  walk((doc ?? { type: "doc" }) as PMNode, 0);
  return lines.join("\n");
}

/** Every checkbox in the note. Gives ids to any that lack one (the editor normally assigns them). */
export function extractTasks(doc: unknown, now = new Date()): NoteTask[] {
  const out: NoteTask[] = [];
  const seen = new Set<string>();
  const walk = (n: PMNode) => {
    if (n.type === "taskItem") {
      n.attrs ??= {};
      let id = typeof n.attrs.id === "string" ? n.attrs.id : "";
      if (!id || seen.has(id)) n.attrs.id = id = randomUUID().slice(0, 8);
      seen.add(id);
      const raw = n.content?.[0] ? textOf(n.content[0]).trim() : "";
      if (raw) {
        const { text, due } = parseDue(raw, now);
        out.push({ id, checked: !!n.attrs.checked, text, due });
      }
    }
    (n.content ?? []).forEach(walk);
  };
  walk((doc ?? { type: "doc" }) as PMNode);
  return out;
}

/** Flip one checkbox in the doc (used when the matching todo is ticked in Today). Returns true if found. */
export function setTaskChecked(doc: unknown, taskId: string, checked: boolean): boolean {
  let found = false;
  const walk = (n: PMNode) => {
    if (n.type === "taskItem" && n.attrs?.id === taskId) {
      n.attrs.checked = checked;
      found = true;
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc as PMNode);
  return found;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** "@today", "@tomorrow", "@fri", "@next-week", "@2026-11-12", "@11/12". Removes the token from the text. */
export function parseDue(raw: string, now = new Date()): { text: string; due?: string } {
  const m =
    /(^|\s)@(today|tomorrow|tmrw|next[- ]?week|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\b/i.exec(
      raw,
    );
  if (!m) return { text: raw };
  const token = m[2].toLowerCase();
  const d = new Date(now);
  if (token === "today") {
    // as is
  } else if (token === "tomorrow" || token === "tmrw") d.setDate(d.getDate() + 1);
  else if (token.startsWith("next")) d.setDate(d.getDate() + 7);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    const [y, mo, da] = token.split("-").map(Number);
    d.setFullYear(y, mo - 1, da);
  } else if (/^\d{1,2}\/\d{1,2}$/.test(token)) {
    // day/month or month/day, the way the Mac's region writes dates
    const [a, b] = token.split("/").map(Number);
    const [da, mo] = localeDayFirst() ? [a, b] : [b, a];
    d.setMonth(mo - 1, da);
    if (d < now && localDate(d) !== localDate(now)) d.setFullYear(d.getFullYear() + 1);
  } else {
    const target = DAYS.indexOf(token.slice(0, 3));
    if (target < 0) return { text: raw };
    const delta = (target - d.getDay() + 7) % 7 || 7; // next occurrence, never today
    d.setDate(d.getDate() + delta);
  }
  return {
    text: raw
      .replace(m[0], " ")
      .replace(/\s{2,}/g, " ")
      .trim(),
    due: localDate(d),
  };
}
