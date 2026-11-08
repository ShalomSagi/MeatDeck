import { EyeOff, FileText, Folder, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type { Action } from "../../../../shared/actions.ts";
import type { DashboardState, Project } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import type { BoardEntry } from "../../board.ts";
import { RefChip } from "../RefChip.tsx";
import { DocIcon } from "../docs/DocIcon.tsx";
import { LinearIcon } from "../icons.tsx";
import { PriorityPicker } from "./PriorityPicker.tsx";
import { ProjectAbout } from "./ProjectAbout.tsx";
import { ActionQueue } from "../queue/ActionQueue.tsx";
import { Badge, Button, Card, SectionHeader } from "../ui.tsx";
import { Board } from "../work/Board.tsx";
import { agoText } from "../../lib.ts";

export function ProjectPage({
  project: p,
  state,
  entries,
  actions,
  onGone,
  onOpenNote,
}: {
  project: Project;
  state: DashboardState;
  entries: BoardEntry[];
  /** This project's slice of the ranked queue. */
  actions: Action[];
  onGone: () => void;
  onOpenNote: (id: string) => void;
}) {
  const discovering =
    (state.run?.status === "running" && state.run.kind === "project" && state.run.label.endsWith(p.name)) ||
    state.nextRuns.some((n) => n.kind === "project");
  const notes = state.notes.filter((n) => n.projectIds.includes(p.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {p.kind === "linear" ? (
          <LinearIcon className="size-4 text-[#5E6AD2]" />
        ) : (
          <Folder className="size-4 text-muted-foreground" />
        )}
        <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
        <Badge variant={p.kind === "linear" ? "primary" : "default"}>
          {p.kind === "linear" ? "Linear project" : "Your project"}
        </Badge>
        <RefChip id={p.ref} />
        <div className="ml-auto flex items-center gap-1.5">
          <PriorityPicker project={p} />
          <Button size="sm" onClick={() => void api.discoverProject(p.id)} disabled={discovering}>
            {discovering ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            {discovering ? "Discovering…" : p.context ? "Refresh context" : "Discover"}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost-muted"
            title="Hide project: no updates, no tokens"
            aria-label="Hide project"
            onClick={() => {
              onGone();
              void api.updateProject(p.id, { ignored: true });
            }}
          >
            <EyeOff />
          </Button>
          {p.kind === "manual" && (
            <Button
              size="icon-sm"
              variant="ghost-muted"
              title="Delete project"
              aria-label="Delete project"
              onClick={() => {
                if (!confirm(`Delete "${p.name}"? Its rules and context go with it.`)) return;
                onGone();
                void api.deleteProject(p.id);
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <section>
        <p className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Next for this project
        </p>
        <ActionQueue
          actions={actions}
          state={state}
          onOpenNote={onOpenNote}
          hideProject
          empty={
            <Card className="px-4 py-3 text-sm text-muted-foreground">
              Nothing needs a move on this project right now.
            </Card>
          }
        />
      </section>

      <section>
        <SectionHeader
          title="Where it stands"
          action={
            p.context && (
              <span className="text-2xs text-muted-foreground/70">Claude, {agoText(p.context.updatedAt)}</span>
            )
          }
        />
        <Card className="px-4 py-3.5">
          {p.context ? (
            <p className="text-sm leading-6 whitespace-pre-line text-foreground/90">{p.context.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {discovering
                ? "Claude is reading Linear, GitHub and Slack for this project…"
                : "No context yet. Press Discover and Claude will find the related work and write a summary."}
            </p>
          )}
        </Card>
      </section>

      {notes.length > 0 && (
        <section>
          <SectionHeader title="Docs" icon={<FileText />} count={notes.length} />
          <Card className="divide-y divide-border">
            {notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpenNote(n.id)}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent/60"
              >
                <DocIcon icon={n.icon} kind={n.kind} className="size-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{n.title || "Untitled"}</span>
                {n.openActions > 0 && <Badge variant="warning">{n.openActions} open</Badge>}
                <span className="text-2xs text-muted-foreground/70">{agoText(n.updatedAt)}</span>
              </button>
            ))}
          </Card>
        </section>
      )}

      <section>
        <p className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Also open · no move needed
        </p>
        {entries.length ? (
          <Board entries={entries} />
        ) : (
          <p className="px-1 text-sm text-muted-foreground">Nothing else open.</p>
        )}
      </section>

      <ProjectAbout project={p} />
    </div>
  );
}
