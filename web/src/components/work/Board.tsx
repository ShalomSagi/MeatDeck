import { ArrowUpRight, Folder, FolderGit2, Hourglass, Trash2 } from "lucide-react";
import { repoShort } from "../../../../shared/projects.ts";
import type { ItemState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { type BoardEntry, STATE_META } from "../../board.ts";
import { SourceIcon } from "../icons.tsx";
import { Badge, Button, Card, Empty, SectionHeader, StatusDot } from "../ui.tsx";
import { ago } from "../../lib.ts";

function BoardRow({ entry, showProject = true }: { entry: BoardEntry; showProject?: boolean }) {
  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/60">
      <div className="mt-0.5 text-muted-foreground">
        <SourceIcon source={entry.source} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm leading-5 hover:underline hover:underline-offset-2"
          >
            {entry.title}
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {showProject &&
            entry.projectNames?.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 text-2xs font-medium text-foreground/75">
                <Folder className="size-3 text-muted-foreground" />
                {name}
              </span>
            ))}
          {showProject && !entry.projectNames?.length && entry.group && (
            <span className="text-2xs text-muted-foreground">{entry.group}</span>
          )}
          {showProject && entry.repo && (
            <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
              <FolderGit2 className="size-3" />
              {repoShort(entry.repo)}
            </span>
          )}
          {entry.badges.map((b) => (
            <Badge key={b.label} variant={b.variant}>
              {b.label}
            </Badge>
          ))}
          {entry.waitingOn && !entry.live && (
            <Badge variant="info">
              <Hourglass /> {entry.waitingOn}
            </Badge>
          )}
        </div>
        {entry.note && <p className="mt-1 text-xs leading-4.5 text-muted-foreground">{entry.note}</p>}
      </div>
      <span className="mt-0.5 shrink-0 text-2xs tabular-nums text-muted-foreground/70" title={entry.updatedAt}>
        {ago(entry.updatedAt)}
      </span>
      <div className="-my-0.5 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        {entry.url && (
          <a href={entry.url} target="_blank" rel="noreferrer" tabIndex={-1}>
            <Button variant="ghost" size="icon-xs" aria-label="Open">
              <ArrowUpRight />
            </Button>
          </a>
        )}
        {entry.itemId && (
          <Button
            variant="ghost-muted"
            size="icon-xs"
            aria-label="Stop tracking"
            onClick={() => api.removeItem(entry.itemId!)}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}

export function Board({ entries, showProject = true }: { entries: BoardEntry[]; showProject?: boolean }) {
  const groups = (Object.keys(STATE_META) as Exclude<ItemState, "done">[]).map((state) => ({
    state,
    entries: entries.filter((e) => e.state === state),
  }));

  if (entries.length === 0)
    return (
      <Card>
        <Empty
          title="Nothing tracked yet"
          hint="Your open PRs show up live. Run /today so Claude adds Linear issues and Slack threads."
        />
      </Card>
    );

  return (
    <div className="flex flex-col gap-5">
      {groups
        .filter((g) => g.entries.length)
        .map((g) => (
          <section key={g.state}>
            <SectionHeader
              title={STATE_META[g.state].label}
              icon={<StatusDot tone={STATE_META[g.state].tone} />}
              count={g.entries.length}
              action={<span className="text-2xs text-muted-foreground/70">{STATE_META[g.state].hint}</span>}
            />
            <Card className="divide-y divide-border overflow-hidden">
              {g.entries.map((e) => (
                <BoardRow key={e.key} entry={e} showProject={showProject} />
              ))}
            </Card>
          </section>
        ))}
    </div>
  );
}
