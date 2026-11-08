/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineAssistantRows.tsx (copy text)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
/** Older chats only have `text` plus flat step strings ("Notion · search  cutover"). */
import type { ChatMessage, ReplyPart } from "../../../../shared/types.ts";
import type { EntryPresentation } from "./WorkEntryRow.logic.ts";
import { uniqueKeys } from "../../lib.ts";

export function legacyParts(m: ChatMessage): { parts: ReplyPart[]; presentations?: EntryPresentation[] } {
  const steps = m.steps ?? [];
  const running = m.status === "running";
  const parts: ReplyPart[] = [];
  let presentations: EntryPresentation[] | undefined;
  if (steps.length > 0) {
    parts.push({
      kind: "work",
      entries: steps.map((s, i) => ({
        id: `step-${i}`,
        tool: s,
        status: running && i === steps.length - 1 ? "running" : "done",
        at: m.at,
      })),
    });
    presentations = steps.map((s) => {
      const [head, ...rest] = s.split(/\s{2,}/);
      return { action: "other", icon: "wrench", label: head, detail: rest.join(" ") || undefined };
    });
  }
  if (m.text) parts.push({ kind: "text", text: m.text });
  return { parts, presentations };
}

/** Text parts have no id: key each by the tool call before it, so a streaming reply keeps its rows mounted. */
export function partKeys(parts: ReplyPart[]): string[] {
  let after = "start";
  return uniqueKeys(parts, (p) => {
    if (p.kind === "text") return `t:${after}`;
    after = p.entries[0]?.id ?? after;
    return `w:${after}`;
  });
}

export function assistantCopyText(m: ChatMessage): string {
  if (!m.parts) return m.text;
  return m.parts.flatMap((p) => (p.kind === "text" && p.text.trim() ? [p.text.trim()] : [])).join("\n\n");
}
