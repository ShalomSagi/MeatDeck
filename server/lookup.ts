// Resolve a readable id ("N-12", "P-3", "T-45"…) to something any Claude can read: plain text,
// with the related ids it can follow next. Used by the meatdeck MCP tools `lookup` and `search`,
// so a Claude session elsewhere (e.g. T3 Code) understands "read N-12".
import { itemEntity, matchProjects, projectsOfTodo } from "../shared/projects.ts";
import { buildActions } from "../shared/actions.ts";
import type { Message, Todo } from "../shared/types.ts";
import { chatList, getChat } from "./chat/chatStore.ts";
import { github } from "./github.ts";
import { store } from "./store/store.ts";

export interface Resolved {
  ref: string;
  /** Internal id, for tools that take one (update_todo, delete…). */
  id?: string;
  type: "doc" | "project" | "todo" | "draft" | "item" | "rule" | "chat" | "suggestion";
  title: string;
  text: string;
}

const norm = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/^MEATDECK[:\s-]*/i, "")
    .replace(/^([A-Z])(\d+)$/, "$1-$2");

/** Every todo/draft across all days, newest first (a carried todo appears once). */
function allTodos(): Todo[] {
  const seen = new Set<string>();
  const out: Todo[] = [];
  for (const d of store.allDays())
    for (const t of d.todos) if (!seen.has(t.ref ?? t.id) && seen.add(t.ref ?? t.id)) out.push(t);
  return out;
}
function allDrafts(): Message[] {
  const seen = new Set<string>();
  const out: Message[] = [];
  for (const d of store.allDays())
    for (const m of d.messages) if (!seen.has(m.ref ?? m.id) && seen.add(m.ref ?? m.id)) out.push(m);
  return out;
}

const ix = () => ({
  projects: store.projects(),
  links: store.links(),
  items: store.items(),
  prs: [...github.mine, ...github.reviewRequests],
});
const projectNames = (ids: string[]) =>
  ids
    .map((id) => store.projects().find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => `${p!.name} (${p!.ref})`)
    .join(", ");

export function resolve(raw: string): Resolved | undefined {
  foundId = undefined;
  const r = resolveInner(raw);
  return r && foundId ? { ...r, id: foundId } : r;
}
let foundId: string | undefined;
function resolveInner(raw: string): Resolved | undefined {
  const ref = norm(raw);
  const byRef = <T extends { ref?: string; id: string }>(list: T[]) => {
    const hit = list.find((x) => x.ref === ref || x.id === raw.trim());
    if (hit) foundId = hit.id;
    return hit;
  };

  const sg = byRef(store.suggestions());
  if (sg)
    return {
      ref: sg.ref ?? sg.id,
      type: "suggestion",
      title: `Suggested project: ${sg.name}`,
      text: [
        `# Suggested project: ${sg.name}  (${sg.ref}, ${sg.status})`,
        sg.description,
        sg.why ? `\nWhy: ${sg.why}` : "",
        `\n## Evidence\n${sg.evidence.map((e) => `- ${e.text}${e.url ? ` ${e.url}` : ""}`).join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };

  const note = byRef(store.notes());
  if (note) {
    const todos = store.today().todos.filter((t) => t.noteId === note.id);
    const projects = matchProjects(
      { key: `note:${note.id}`, title: note.title, text: note.text },
      store.projects(),
      store.links(),
    );
    return {
      ref: note.ref ?? note.id,
      type: "doc",
      title: note.title || "Untitled",
      text: [
        `# ${note.icon ? `${note.icon} ` : ""}${note.title || "Untitled"}  (${note.ref}, ${note.kind === "meeting" ? "meeting doc" : "doc"}, created ${note.createdAt.slice(0, 10)}, edited ${note.updatedAt.slice(0, 16).replace("T", " ")})`,
        projects.length ? `Projects: ${projectNames(projects)}` : "",
        "",
        note.text || "(empty)",
        todos.length
          ? `\nAction items from this doc: ${todos.map((t) => `${t.ref} [${t.status === "done" ? "x" : " "}] ${t.title}${t.due ? ` (due ${t.due})` : ""}`).join("; ")}`
          : "",
      ]
        .filter((l) => l !== "")
        .join("\n"),
    };
  }

  const project = byRef(store.projects());
  if (project) {
    const actions = buildActions({
      state: {
        sent: store.sentLog(),
        today: store.today().date,
        day: store.today(),
        items: store.items(),
        github,
        projects: store.projects(),
        projectLinks: store.links(),
        settings: store.settings(),
        priorities: store.priorities(),
        snoozes: store.snoozes(),
        dismissed: store.dismissals(),
        reviewAsks: store.reviewAsks(),
        reviewAskLog: store.reviewAskLog(),
      },
    }).open.filter((a) => a.projectIds.includes(project.id));
    const notes = store
      .notes()
      .filter((n) =>
        matchProjects({ key: `note:${n.id}`, title: n.title, text: n.text }, store.projects(), store.links()).includes(
          project.id,
        ),
      );
    const rules = Object.entries(project.rules)
      .filter(([, v]) => v.length)
      .map(([k, v]) => `${k}: ${v.join(", ")}`);
    return {
      ref: project.ref ?? project.id,
      type: "project",
      title: project.name,
      text: [
        `# Project: ${project.name}  (${project.ref}, ${project.kind === "linear" ? "Linear project" : "user project"}${project.ignored ? ", hidden" : ""})`,
        project.url ? `Link: ${project.url}` : "",
        project.description ? `\n## Description\n${project.description}` : "",
        project.context
          ? `\n## Where it stands (as of ${project.context.updatedAt.slice(0, 10)})\n${project.context.summary}`
          : "",
        actions.length
          ? `\n## Next actions\n${actions.map((a) => `- [${a.tier}${a.ball === "them" ? ", their move" : ""}] ${a.title}${a.why ? ` — ${a.why}` : ""}${a.url ? ` ${a.url}` : ""}`).join("\n")}`
          : "",
        notes.length
          ? `\n## Docs\n${notes.map((n) => `- ${n.ref} ${n.icon ? `${n.icon} ` : ""}${n.title || "Untitled"}`).join("\n")}`
          : "",
        rules.length ? `\n## Matched by\n${rules.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const todo = byRef(allTodos());
  if (todo) {
    const doc = todo.noteId ? store.notes().find((n) => n.id === todo.noteId) : undefined;
    const projects = projectsOfTodo(todo, ix());
    return {
      ref: todo.ref ?? todo.id,
      type: "todo",
      title: todo.title,
      text: [
        `Todo ${todo.ref}: ${todo.title}`,
        `Status: ${todo.status} · priority ${todo.priority}${todo.due ? ` · due ${todo.due}` : ""} · by ${todo.createdBy}`,
        todo.notes ? `Notes: ${todo.notes}` : "",
        todo.url ? `Link: ${todo.url}` : "",
        doc ? `From doc: ${doc.ref} ${doc.title}` : "",
        projects.length ? `Projects: ${projectNames(projects)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const draft = byRef(allDrafts());
  if (draft)
    return {
      ref: draft.ref ?? draft.id,
      type: "draft",
      title: `Message to ${draft.to}`,
      text: [
        `Draft ${draft.ref} to ${draft.to} via ${draft.channel}${draft.threadTs ? " (thread reply)" : ""} · status: ${draft.status}`,
        `Why: ${draft.reason}`,
        draft.url ? `About: ${draft.url}` : "",
        `\n${draft.text}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };

  const item = byRef(store.items());
  if (item) {
    const projects = matchProjects(itemEntity(item), store.projects(), store.links());
    return {
      ref: item.ref ?? item.id,
      type: "item",
      title: item.title,
      text: [
        `Tracked item ${item.ref} (${item.id}): ${item.title}`,
        `Source: ${item.source} · state: ${item.state}${item.status ? ` · ${item.status}` : ""}${item.waitingOn ? ` · waiting on ${item.waitingOn}` : ""}`,
        item.url ? `Link: ${item.url}` : "",
        item.note ? `Note: ${item.note}` : "",
        projects.length ? `Projects: ${projectNames(projects)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const rule = byRef(store.rules());
  if (rule)
    return {
      ref: rule.ref ?? rule.id,
      type: "rule",
      title: rule.text,
      text: `Rule ${rule.ref} (${rule.kind}${rule.pattern ? `, pattern "${rule.pattern}"` : ""}${rule.enabled ? "" : ", off"}): ${rule.text}`,
    };

  const meta = chatList().find((c) => c.ref === ref || c.id === raw.trim());
  const chat = meta && getChat(meta.id);
  if (chat)
    return {
      ref: chat.ref ?? chat.id,
      type: "chat",
      title: chat.title,
      text: [
        `MeatDeck chat ${chat.ref}: ${chat.title}`,
        ...chat.messages.map((m) => `\n${m.role === "user" ? "User" : "Claude"}: ${m.text.slice(0, 1500)}`),
      ].join("\n"),
    };
  return undefined;
}

/** Find things by words in their title/text. Returns ids + titles to `lookup` next. */
export function search(
  q: string,
  limit = 15,
): { ref: string; type: Resolved["type"]; title: string; snippet?: string }[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hit = (hay: string) => {
    const h = hay.toLowerCase();
    return words.every((w) => h.includes(w));
  };
  const out: { ref: string; type: Resolved["type"]; title: string; snippet?: string; score: number }[] = [];
  const add = (ref: string | undefined, type: Resolved["type"], title: string, body: string, boost = 0) => {
    if (!ref || !hit(`${title}\n${body}`)) return;
    const i = body.toLowerCase().indexOf(words[0]);
    out.push({
      ref,
      type,
      title,
      snippet: i >= 0 ? body.slice(Math.max(0, i - 40), i + 100).replace(/\s+/g, " ") : undefined,
      score: (hit(title) ? 2 : 0) + boost,
    });
  };
  for (const n of store.notes()) add(n.ref, "doc", n.title || "Untitled", n.text, 1);
  for (const p of store.projects()) add(p.ref, "project", p.name, `${p.description}\n${p.context?.summary ?? ""}`, 1);
  for (const t of allTodos()) add(t.ref, "todo", t.title, t.notes ?? "", t.status === "open" ? 0.5 : 0);
  for (const m of allDrafts()) add(m.ref, "draft", `Message to ${m.to}`, `${m.text}\n${m.reason}`);
  for (const i of store.items()) add(i.ref, "item", i.title, `${i.status ?? ""} ${i.note ?? ""}`);
  for (const r of store.rules()) add(r.ref, "rule", r.text, r.pattern ?? "");
  for (const c of chatList()) add(c.ref, "chat", c.title, "");
  for (const s of store.suggestions())
    if (s.status === "pending") add(s.ref, "suggestion", s.name, `${s.description}\n${s.why}`);
  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}
