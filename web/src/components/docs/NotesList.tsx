import { CheckSquare, FileText, Folder, Pin, Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import type { NoteMeta, Project } from "../../../../shared/types.ts";
import { RefChip } from "../RefChip.tsx";
import { DocIcon } from "./DocIcon.tsx";
import { Badge, Button, Card, Empty } from "../ui.tsx";
import { agoText } from "../../lib.ts";

export function NotesList({
  notes,
  projects,
  onOpen,
  onNew,
}: {
  notes: NoteMeta[];
  projects: Project[];
  onOpen: (id: string) => void;
  onNew: (kind: "note" | "meeting") => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = notes
    .filter((n) => !query || `${n.title} ${n.preview}`.toLowerCase().includes(query))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const name = (id: string) => projects.find((p) => p.id === id)?.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 min-w-56 flex-1 items-center gap-2 rounded-lg border border-input bg-popover px-2.5 dark:bg-input/32">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search docs…"
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => onNew("meeting")}>
          <Users /> New meeting
        </Button>
        <Button size="sm" variant="default" onClick={() => onNew("note")}>
          <Plus /> New doc
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <Empty
            icon={<FileText />}
            title={notes.length ? "No docs match" : "No docs yet"}
            hint={
              notes.length
                ? undefined
                : "Write during meetings. Checkboxes become todos in Today, @tomorrow sets a due date, and Claude follows up on what you wrote."
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {shown.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpen(n.id)}
              className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60"
            >
              <span className="mt-0.5 text-muted-foreground">
                <DocIcon icon={n.icon} kind={n.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{n.title || "Untitled"}</span>
                  <RefChip id={n.ref} />
                  {n.pinned && <Pin className="size-3 text-muted-foreground" />}
                </div>
                {n.preview && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.preview}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {n.openActions > 0 && (
                    <Badge variant="warning">
                      <CheckSquare /> {n.openActions} open
                    </Badge>
                  )}
                  {n.openActions === 0 && n.doneActions > 0 && (
                    <Badge variant="success">
                      <CheckSquare /> all {n.doneActions} done
                    </Badge>
                  )}
                  {n.projectIds.map((id) =>
                    name(id) ? (
                      <span key={id} className="inline-flex items-center gap-1 text-2xs text-foreground/75">
                        <Folder className="size-3 text-muted-foreground" />
                        {name(id)}
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
              <span className="mt-0.5 shrink-0 text-2xs text-muted-foreground/70">{agoText(n.updatedAt)}</span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
