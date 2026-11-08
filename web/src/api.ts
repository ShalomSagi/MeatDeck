import { useEffect, useEffectEvent, useState } from "react";
import {
  hiddenBy,
  itemEntity,
  itemRepo,
  matchProjects,
  prEntity,
  projectsOfMessage,
  projectsOfTodo,
  repoIgnored,
  repoOfUrl,
} from "../../shared/projects.ts";
import type { Integration } from "../../shared/integrations.ts";
import type { ModelSelection, ProviderId, ProviderStatus } from "../../shared/providers.ts";
import type {
  Chat,
  ContextRef,
  DashboardState,
  Message,
  Note,
  OpenItem,
  Project,
  ProjectRules,
  RunKind,
  Settings,
  Todo,
  UpdateStatus,
} from "../../shared/types.ts";

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  addTodo: (title: string) => call("POST", "/api/todos", { title, createdBy: "me", source: "manual" }),
  updateTodo: (id: string, patch: Partial<Todo>) => call("PATCH", `/api/todos/${id}`, patch),
  removeTodo: (id: string) => call("DELETE", `/api/todos/${id}`),
  reorderTodos: (ids: string[]) => call("POST", "/api/todos/reorder", { ids }),
  updateMessage: (id: string, patch: Partial<Message>) => call("PATCH", `/api/messages/${id}`, patch),
  removeItem: (id: OpenItem["id"]) => call("DELETE", `/api/items/${encodeURIComponent(id)}`),
  refreshGithub: () => call("POST", "/api/github/refresh", {}),
  runClaude: (kind: Exclude<RunKind, "send" | "project" | "revise" | "voice" | "linear"> = "manual") =>
    call("POST", "/api/claude/run", { kind }),
  sendMessages: (ids: string[], edits: Record<string, string> = {}) =>
    call("POST", "/api/messages/send", { ids, edits }),
  updateSettings: (patch: Partial<Settings>) => call("PATCH", "/api/settings", patch),
  runLog: async (id: string) => {
    const res = await fetch(`/api/runs/${id}/log`);
    return res.ok ? res.text() : "Log not available.";
  },
  createProject: (name: string, description: string) => call<Project>("POST", "/api/projects", { name, description }),
  updateProject: (
    id: string,
    patch: Partial<Pick<Project, "name" | "description" | "ignored">> & { priority?: number | null } & {
      removeRules?: Partial<ProjectRules>;
    },
  ) => call<Project>("PATCH", `/api/projects/${id}`, patch),
  deleteProject: (id: string) => call("DELETE", `/api/projects/${id}`),
  discoverProject: (id: string) => call("POST", `/api/projects/${id}/discover`, {}),
  getNote: (id: string) => call<Note>("GET", `/api/notes/${id}`),
  createNote: (input: { title?: string; kind?: Note["kind"]; doc?: unknown; icon?: string }) =>
    call<Note>("POST", "/api/notes", input),
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "doc" | "pinned" | "kind" | "icon">>) =>
    call<{ id: string; updatedAt: string; doc: unknown }>("PATCH", `/api/notes/${id}`, patch),
  deleteNote: (id: string) => call("DELETE", `/api/notes/${id}`),
  revise: (kind: "message" | "todo", id: string, instruction: string) =>
    call("POST", "/api/revise", { kind, id, instruction }),
  deletePreference: (id: string) => call("DELETE", `/api/preferences/${id}`),
  learnVoice: () => call("POST", "/api/voice/learn", {}),
  setVoice: (patch: { guide: string; examples?: string[] }) => call("PUT", "/api/voice", patch),
  getChat: (id: string) => call<Chat>("GET", `/api/chats/${id}`),
  startChat: (text: string, context: ContextRef[], s: ModelSelection) =>
    call<Chat>("POST", "/api/chats", { text, context, model: s.model, provider: s.provider, effort: s.effort }),
  sendChat: (id: string, text: string, context: ContextRef[], s: ModelSelection) =>
    call<Chat>("POST", `/api/chats/${id}/messages`, {
      text,
      context,
      model: s.model,
      provider: s.provider,
      effort: s.effort,
    }),
  checkUpdate: () => call<UpdateStatus>("POST", "/api/update/check", {}),
  applyUpdate: () => call<UpdateStatus>("POST", "/api/update/apply", {}),
  refreshProviders: (id?: ProviderId) => call<ProviderStatus[]>("POST", "/api/providers/refresh", id ? { id } : {}),
  setProviderEnabled: (id: ProviderId, enabled: boolean) =>
    call<ProviderStatus[]>("POST", `/api/providers/${id}/enabled`, { enabled }),
  stopChat: (id: string) => call("POST", `/api/chats/${id}/stop`, {}),
  deleteChat: (id: string) => call("DELETE", `/api/chats/${id}`),
  startInT3: (a: { url: string; repo: string; number: number; verb: string; title: string; prompt: string }) =>
    call<{ ok: boolean; threadId?: string; error?: string }>("POST", "/api/actions/t3", a),
  acceptSuggestion: (id: string, patch?: { name?: string }) =>
    call<Project>("POST", `/api/suggestions/${id}/accept`, patch ?? {}),
  dismissSuggestion: (id: string) => call<{ ok: boolean }>("POST", `/api/suggestions/${id}/dismiss`, {}),
  dismissAction: (key: string) => call<{ ok: boolean }>("POST", "/api/actions/dismiss", { key }),
  markActionDone: (key: string) => call<{ ok: boolean }>("POST", "/api/actions/dismiss", { key, done: true }),
  restoreAction: (key: string) => call<{ ok: boolean }>("DELETE", `/api/actions/dismiss/${encodeURIComponent(key)}`),
  peekGithub: () => call<{ ok: boolean }>("POST", "/api/github/peek", {}),
  rerunFailed: (url: string) =>
    call<{ ok: boolean; message?: string; error?: string }>("POST", "/api/actions/rerun", { url }),
  mergePr: (url: string) =>
    call<{ ok: boolean; method?: string; error?: string }>("POST", "/api/actions/merge", { url }),
  snooze: (key: string, until?: string) => call("POST", "/api/actions/snooze", { key, until }),
  assist: (key: string, instruction?: string) => call("POST", "/api/actions/assist", { key, instruction }),
  clearPriority: (key: string) => call("DELETE", `/api/priorities/${encodeURIComponent(key)}`),
  addRule: (rule: { kind: "instruction" | "ignore_check"; text: string; pattern?: string }) =>
    call("POST", "/api/rules", rule),
  updateRule: (id: string, patch: { text?: string; pattern?: string; enabled?: boolean }) =>
    call("PATCH", `/api/rules/${id}`, patch),
  deleteRule: (id: string) => call("DELETE", `/api/rules/${id}`),
  decidePermission: (id: string, decision: "allow" | "always" | "deny") =>
    call("POST", `/api/permissions/${id}/decide`, { decision }),
  createIntegration: (i: Omit<Integration, "id"> & { id?: string }) =>
    call<Integration>("POST", "/api/integrations", i),
  saveIntegration: (i: Integration) => call<Integration>("PUT", `/api/integrations/${encodeURIComponent(i.id)}`, i),
  deleteIntegration: (id: string) => call("DELETE", `/api/integrations/${encodeURIComponent(id)}`),
  runIntegrationAction: (id: string, action: string, input: Record<string, string>, allowWrite = false) =>
    call<{ ok: boolean; output?: unknown; error?: string }>("POST", `/api/integrations/${encodeURIComponent(id)}/run`, {
      action,
      input,
      allowWrite,
    }),
  setIntegrationSecret: (id: string, name: string, value: string) =>
    call("POST", `/api/integrations/${encodeURIComponent(id)}/secret`, { name, value }),
  refreshIntegrationStatus: () => call("POST", "/api/integrations/status", {}),
  mcpServers: () => call<{ name: string; state: string }[]>("GET", "/api/mcp-servers"),
};

/** Hide ignored repos and projects once, here, so every view, count and badge agrees. */
function withoutIgnored(s: DashboardState): DashboardState {
  const { ignoredRepos } = s.settings;
  if (!ignoredRepos.length && !s.projects.some((p) => p.ignored)) return s;
  const ix = {
    projects: s.projects,
    links: s.projectLinks,
    items: s.items,
    prs: [...s.github.mine, ...s.github.reviewRequests],
  };
  const hide = (repo: string | undefined, ids: string[]) => hiddenBy(repo, ids, s.projects, ignoredRepos);
  return {
    ...s,
    items: s.items.filter((i) => !hide(itemRepo(i), matchProjects(itemEntity(i), s.projects, s.projectLinks))),
    github: {
      ...s.github,
      mine: s.github.mine.filter((p) => !hide(p.repo, matchProjects(prEntity(p), s.projects, s.projectLinks))),
      reviewRequests: s.github.reviewRequests.filter(
        (p) => !hide(p.repo, matchProjects(prEntity(p), s.projects, s.projectLinks)),
      ),
    },
    day: {
      ...s.day,
      todos: s.day.todos.filter((t) => !hide(repoOfUrl(t.url), projectsOfTodo(t, ix))),
      messages: s.day.messages.filter((m) => !hide(repoOfUrl(m.url), projectsOfMessage(m, ix))),
    },
    events: s.events.filter((e) => !repoIgnored(repoOfUrl(e.url), ignoredRepos)),
  };
}

/** Live dashboard state over SSE; reconnects on its own. */
export function useDashboard(onChat?: (chat: Chat) => void) {
  const [state, setState] = useState<DashboardState | null>(null);
  const [connected, setConnected] = useState(false);
  const onChatEvent = useEffectEvent((chat: Chat) => onChat?.(chat));

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s: DashboardState) => setState((cur) => cur ?? withoutIgnored(s)))
      .catch(() => {});
    const es = new EventSource("/api/events");
    es.addEventListener("state", (e) => {
      setState(withoutIgnored(JSON.parse((e as MessageEvent).data)));
      setConnected(true);
    });
    // Chat replies stream token by token on their own event.
    es.addEventListener("chat", (e) => onChatEvent(JSON.parse((e as MessageEvent).data)));
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return { state, connected };
}

/** Add or remove a repo ("owner/name") from the ignore list. */
export function setRepoIgnored(current: string[], repo: string, ignore: boolean) {
  const rest = current.filter((r) => r.trim().toLowerCase() !== repo.trim().toLowerCase());
  return api.updateSettings({ ignoredRepos: ignore ? [...rest, repo.trim()] : rest });
}
