// Context chips: a stable key and a readable label + icon for each kind of attached ref.
import { Folder, FolderGit2, LayoutList, MessageSquareText, MessagesSquare, Sunrise } from "lucide-react";
import type { ReactNode } from "react";
import { repoShort } from "../../../../shared/projects.ts";
import type { ContextRef, DashboardState } from "../../../../shared/types.ts";
import { DocIcon } from "../docs/DocIcon.tsx";

export function refKey(r: ContextRef) {
  return r.type === "project" || r.type === "note"
    ? `${r.type}:${r.id}`
    : r.type === "repo"
      ? `repo:${r.repo}`
      : r.type === "action"
        ? `action:${r.key}`
        : r.type === "draft"
          ? `draft:${r.id}`
          : r.type;
}

export function refLabel(r: ContextRef, state: DashboardState): { label: string; icon: ReactNode } {
  switch (r.type) {
    case "today":
      return { label: "Today", icon: <Sunrise /> };
    case "work":
      return { label: "Open work", icon: <LayoutList /> };
    case "project":
      return { label: state.projects.find((p) => p.id === r.id)?.name ?? "Project", icon: <Folder /> };
    case "note": {
      const n = state.notes.find((x) => x.id === r.id);
      return { label: n?.title || "Untitled doc", icon: <DocIcon icon={n?.icon} kind={n?.kind} /> };
    }
    case "repo":
      return { label: repoShort(r.repo), icon: <FolderGit2 /> };
    case "action":
      return { label: r.title.length > 48 ? `${r.title.slice(0, 47)}…` : r.title, icon: <MessagesSquare /> };
    case "draft":
      return { label: r.title.length > 48 ? `${r.title.slice(0, 47)}…` : r.title, icon: <MessageSquareText /> };
  }
}
