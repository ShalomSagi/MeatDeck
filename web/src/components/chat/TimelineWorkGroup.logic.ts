/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineWorkGroupRows.logic.ts
 *   packages/client-runtime/src/work-log/presentation.ts (tool-group summary wording)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import type { EntryPresentation, IconName, ToolAction } from "./WorkEntryRow.logic.ts";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function actionGroupLabel(action: Exclude<ToolAction, "mcp">, n: number): string {
  switch (action) {
    case "command":
      return `Ran ${plural(n, "command", "commands")}`;
    case "read":
      return `Read ${plural(n, "file", "files")}`;
    case "edit":
      return `Changed ${plural(n, "file", "files")}`;
    case "code-search":
      return `Searched code ${plural(n, "time", "times")}`;
    case "search":
      return `Searched the web ${plural(n, "time", "times")}`;
    case "fetch":
      return `Fetched ${plural(n, "page", "pages")}`;
    case "agent":
      return `Ran ${plural(n, "agent", "agents")}`;
    case "todo":
      return n === 1 ? "Updated todos" : `Updated todos ${n} times`;
    case "other":
      return `Used ${plural(n, "tool", "tools")}`;
  }
}

/** T3's summarizeToolGroup: "Used Slack integration and ran 2 commands", at most two kinds plus "N other actions". */
export function summarizeGroup(items: EntryPresentation[]): { summary: string; icon: IconName } {
  const sources = [...new Set(items.flatMap((p) => (p.source ? [p.source] : [])))];
  const groups = new Map<Exclude<ToolAction, "mcp">, number>();
  for (const p of items) if (p.action !== "mcp") groups.set(p.action, (groups.get(p.action) ?? 0) + 1);
  const priority = (a: ToolAction) => (a === "command" || a === "edit" ? 0 : a === "other" ? 2 : 1);
  const selected = [...groups].map(([action, count], index) => ({ action, count, index }));
  const top = [...selected]
    .sort((a, b) => priority(a.action) - priority(b.action) || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index);
  const labels = top.map((g) => actionGroupLabel(g.action, g.count));
  if (sources.length > 0) {
    const names =
      sources.length < 2
        ? sources[0]
        : sources.length === 2
          ? sources.join(" and ")
          : `${sources.slice(0, -1).join(", ")}, and ${sources.at(-1)}`;
    labels.unshift(`Used ${names} ${sources.length === 1 ? "integration" : "integrations"}`);
  }
  const remaining = items.length - items.filter((p) => p.source).length - top.reduce((n, g) => n + g.count, 0);
  if (remaining > 0) labels.push(`Performed ${plural(remaining, "other action", "other actions")}`);
  const sentence = labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1)));
  const summary =
    sentence.length < 3 ? sentence.join(" and ") : `${sentence.slice(0, -1).join(", ")}, and ${sentence.at(-1)}`;
  const kinds = new Set(items.map((p) => p.action));
  const icon = kinds.size === 1 ? items[0].icon : "hammer";
  return { summary, icon };
}
