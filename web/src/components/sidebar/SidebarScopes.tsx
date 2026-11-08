// Projects (conceptual: Linear projects + ones you create) and Repos (where code lives)
// as two separate sidebar groups, plus the recent docs.
import { Folder, FolderGit2, Pin } from "lucide-react";
import { useMemo, useState } from "react";
import { projectPriority, repoShort, sameRepo } from "../../../../shared/projects.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import { api, setRepoIgnored } from "../../api.ts";
import type { BoardEntry } from "../../board.ts";
import { DocIcon } from "../docs/DocIcon.tsx";
import { LinearIcon } from "../icons.tsx";
import { NewProjectDialog } from "../projects/NewProjectDialog.tsx";
import { PriorityIcon } from "../projects/PriorityIcon.tsx";
import type { Scope } from "../projects/scope.ts";
import { HiddenList } from "./HiddenList.tsx";
import { SidebarAddButton } from "./SidebarAddButton.tsx";
import { SidebarRow } from "./SidebarRow.tsx";
import { SidebarSection } from "./SidebarSection.tsx";
import { rankProjects, rankRepos, recentNotes } from "./SidebarScopes.logic.ts";

export function SidebarScopes({
  state,
  board,
  scope,
  onScope,
  activeNoteId,
  onOpenNote,
  onNewNote,
  onAllNotes,
}: {
  state: DashboardState;
  board: BoardEntry[];
  scope: Scope;
  onScope: (s: Scope) => void;
  activeNoteId: string | null;
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onAllNotes: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const sidebarNotes = recentNotes(state.notes);

  const projects = useMemo(() => rankProjects(state.projects, board), [state.projects, board]);
  const repos = useMemo(() => rankRepos(board), [board]);

  const hiddenProjects = state.projects.filter((p) => p.ignored);
  const hiddenRepos = state.settings.ignoredRepos;

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      <SidebarSection id="notes" title="Docs" action={<SidebarAddButton label="New doc" onClick={onNewNote} />}>
        {sidebarNotes.length === 0 && (
          <button
            type="button"
            onClick={onNewNote}
            className="w-full cursor-pointer px-2.5 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            Write a doc. Checkboxes become todos.
          </button>
        )}
        {sidebarNotes.map((n) => (
          <SidebarRow
            key={n.id}
            icon={
              n.icon || n.kind === "meeting" || !n.pinned ? (
                <DocIcon icon={n.icon} kind={n.kind} className="size-3.5" />
              ) : (
                <Pin className="size-3.5" />
              )
            }
            label={n.title || "Untitled"}
            total={n.openActions}
            needsMe={0}
            active={activeNoteId === n.id}
            onClick={() => onOpenNote(n.id)}
          />
        ))}
        {state.notes.length > sidebarNotes.length && (
          <button
            type="button"
            onClick={onAllNotes}
            className="w-full cursor-pointer px-2.5 py-1 text-left text-2xs text-sidebar-muted-foreground hover:text-sidebar-foreground"
          >
            All {state.notes.length} docs →
          </button>
        )}
      </SidebarSection>

      <SidebarSection
        id="projects"
        title="Projects"
        action={<SidebarAddButton label="New project" onClick={() => setCreating(true)} />}
      >
        {projects.length === 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full cursor-pointer px-2.5 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            Create a project, and Claude will group the related tickets, PRs and threads.
          </button>
        )}
        {projects.map(({ p, total, needsMe }) => (
          <SidebarRow
            key={p.id}
            icon={
              p.kind === "linear" ? <LinearIcon className="size-3.5 text-[#5E6AD2]" /> : <Folder className="size-3.5" />
            }
            label={p.name}
            badge={
              projectPriority(p).level ? (
                <PriorityIcon level={projectPriority(p).level} className="size-3 text-sidebar-muted-foreground" />
              ) : undefined
            }
            total={total}
            needsMe={needsMe}
            active={scope?.kind === "project" && scope.id === p.id}
            onClick={() => onScope({ kind: "project", id: p.id })}
            onHide={() => {
              if (scope?.kind === "project" && scope.id === p.id) onScope(null);
              void api.updateProject(p.id, { ignored: true });
            }}
          />
        ))}
      </SidebarSection>

      <SidebarSection id="repos" title="Repos" defaultOpen={false} count={repos.length}>
        {repos.length === 0 && <p className="px-2.5 py-1 text-xs text-muted-foreground">No open PRs</p>}
        {repos.map(({ repo, total, needsMe }) => (
          <SidebarRow
            key={repo}
            icon={<FolderGit2 className="size-3.5" />}
            label={repoShort(repo)}
            title={repo}
            mono
            total={total}
            needsMe={needsMe}
            active={scope?.kind === "repo" && sameRepo(scope.repo, repo)}
            onClick={() => onScope({ kind: "repo", repo })}
            onHide={() => {
              if (scope?.kind === "repo" && sameRepo(scope.repo, repo)) onScope(null);
              void setRepoIgnored(hiddenRepos, repo, true);
            }}
          />
        ))}
      </SidebarSection>

      <HiddenList
        rows={[
          ...hiddenProjects.map((p) => ({
            key: `p:${p.id}`,
            label: p.name,
            kind: "Project",
            restore: () => api.updateProject(p.id, { ignored: false }),
          })),
          ...hiddenRepos.map((r) => ({
            key: `r:${r}`,
            label: repoShort(r),
            kind: "Repo",
            restore: () => setRepoIgnored(hiddenRepos, r, false),
          })),
        ]}
      />

      {creating && (
        <NewProjectDialog
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            onScope({ kind: "project", id: p.id });
          }}
        />
      )}
    </div>
  );
}
