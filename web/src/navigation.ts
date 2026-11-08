// Which page is showing: the views, their titles, and what each one attaches to the composer.
import { repoShort } from "../../shared/projects.ts";
import type { ContextRef, DashboardState } from "../../shared/types.ts";
import type { Scope } from "./components/projects/scope.ts";
import type { SettingsPage } from "./components/settings/settingsSearch.tsx";

export type View = "today" | "work" | "notes" | "chat" | "history" | "settings" | "usage" | "integrations";

const TITLES: Record<View, string> = {
  today: "Today",
  work: "Work",
  notes: "Docs",
  chat: "Chat",
  history: "History",
  settings: "Settings",
  integrations: "Integrations",
  usage: "Usage",
};

/** Where a nav click lands. `settingsPage` is set only when it changes. */
export function navTarget(
  v: View,
  page: SettingsPage | undefined,
  current: SettingsPage,
): { view: View; settingsPage?: SettingsPage } {
  // Integrations is a Settings page now; the footer button still jumps straight to it.
  if (v === "integrations") page = "integrations";
  if (v === "settings" || v === "integrations")
    return { view: "settings", settingsPage: page ?? (current === "integrations" ? "general" : current) };
  return { view: v };
}

/** The page you're on, attached to what you ask by default. */
export function pageRefFor(view: View, scope: Scope, noteId: string | null): ContextRef | null {
  return view === "today"
    ? { type: "today" }
    : view === "work" && scope?.kind === "project"
      ? { type: "project", id: scope.id }
      : view === "work" && scope?.kind === "repo"
        ? { type: "repo", repo: scope.repo }
        : view === "work"
          ? { type: "work" }
          : view === "notes" && noteId
            ? { type: "note", id: noteId }
            : null;
}

export function pageTitle(
  view: View,
  scope: Scope,
  noteId: string | null,
  state: Pick<DashboardState, "projects" | "notes">,
): string {
  const noteMeta = noteId ? state.notes.find((n) => n.id === noteId) : undefined;
  return view === "work" && scope
    ? scope.kind === "project"
      ? (state.projects.find((p) => p.id === scope.id)?.name ?? "Project")
      : repoShort(scope.repo)
    : view === "notes" && noteId
      ? noteMeta?.title || "Untitled"
      : TITLES[view];
}
