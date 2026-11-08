// Work: where every project stands, ordered by its most urgent next move.
// Same queue as Today, grouped by project (or repo when no project claims it).
import { ChevronRight, Folder, FolderGit2 } from "lucide-react";
import { useState } from "react";
import type { Action } from "../../../../shared/actions.ts";
import { repoShort } from "../../../../shared/projects.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import type { BoardEntry } from "../../board.ts";
import { LinearIcon } from "../icons.tsx";
import type { Scope } from "../projects/scope.ts";
import { ActionRow } from "../queue/ActionRow.tsx";
import { Card, cn, Empty, StatusDot } from "../ui.tsx";

interface Group {
  key: string;
  label: string;
  icon: React.ReactNode;
  scope: Scope;
  actions: Action[];
  moving: number;
  top: number;
}

export function WorkView({
  state,
  actions,
  board,
  onScope,
  onOpenNote,
}: {
  state: DashboardState;
  actions: Action[];
  board: BoardEntry[];
  onScope: (s: Scope) => void;
  onOpenNote: (id: string) => void;
}) {
  const groups = new Map<string, Group>();
  const ensure = (key: string, make: () => Omit<Group, "actions" | "moving" | "top">) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { ...make(), actions: [], moving: 0, top: 0 }));
    return g;
  };
  const projectGroup = (id: string) => {
    const p = state.projects.find((x) => x.id === id);
    return ensure(`p:${id}`, () => ({
      key: `p:${id}`,
      label: p?.name ?? "Project",
      icon:
        p?.kind === "linear" ? (
          <LinearIcon className="size-4 text-[#5E6AD2]" />
        ) : (
          <Folder className="size-4 text-muted-foreground" />
        ),
      scope: { kind: "project", id },
    }));
  };
  const repoGroup = (repo: string) =>
    ensure(`r:${repo}`, () => ({
      key: `r:${repo}`,
      label: repoShort(repo),
      icon: <FolderGit2 className="size-4 text-muted-foreground" />,
      scope: { kind: "repo", repo },
    }));
  const other = () =>
    ensure("other", () => ({
      key: "other",
      label: "Everything else",
      icon: <Folder className="size-4 text-muted-foreground" />,
      scope: null,
    }));

  // An action shows under its first project; without one, under its repo; otherwise "Everything else".
  for (const a of actions) {
    const g = a.projectIds[0] ? projectGroup(a.projectIds[0]) : a.repo ? repoGroup(a.repo) : other();
    g.actions.push(a);
    g.top = Math.max(g.top, a.score);
  }
  // Things that are moving and need nothing from anyone: counted, not listed.
  const actionUrls = new Set(actions.map((a) => a.url).filter(Boolean));
  for (const e of board) {
    if (e.url && actionUrls.has(e.url)) continue;
    if (e.state !== "in_progress") continue;
    const g = e.projectIds[0] ? projectGroup(e.projectIds[0]) : e.repo ? repoGroup(e.repo) : other();
    g.moving++;
  }

  const ordered = [...groups.values()]
    .filter((g) => g.actions.length || g.moving)
    .sort((a, b) => b.top - a.top || b.actions.length - a.actions.length);
  if (!ordered.length)
    return (
      <Card>
        <Empty title="No open work" hint="Your PRs, review requests and tracked tickets show up here." />
      </Card>
    );

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((g) => (
        <WorkGroup key={g.key} g={g} state={state} onScope={onScope} onOpenNote={onOpenNote} />
      ))}
    </div>
  );
}

function WorkGroup({
  g,
  state,
  onScope,
  onOpenNote,
}: {
  g: Group;
  state: DashboardState;
  onScope: (s: Scope) => void;
  onOpenNote: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const now = g.actions.filter((a) => a.tier === "now").length;
  const today = g.actions.filter((a) => a.tier === "today").length;
  const theirs = g.actions.filter((a) => a.ball === "them").length;
  const shown = all ? g.actions : g.actions.slice(0, 4);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        disabled={!g.scope}
        onClick={() => g.scope && onScope(g.scope)}
        className={cn(
          "flex w-full items-center gap-2.5 border-b border-border px-3.5 py-2.5 text-left",
          g.scope && "cursor-pointer hover:bg-accent/50",
        )}
      >
        {g.icon}
        <span className="text-sm font-semibold">{g.label}</span>
        {now > 0 && <StatusDot tone="error" />}
        <span className="text-2xs text-muted-foreground">
          {[
            now && `${now} now`,
            today && `${today} today`,
            theirs && `${theirs} waiting on others`,
            g.moving && `${g.moving} moving`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {g.scope && <ChevronRight className="ml-auto size-4 text-muted-foreground/60" />}
      </button>
      {shown.length > 0 && (
        <div className="divide-y divide-border">
          {shown.map((a) => (
            <ActionRow key={a.key} a={a} state={state} onOpenNote={onOpenNote} hideProject />
          ))}
        </div>
      )}
      {g.actions.length > 4 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="w-full cursor-pointer border-t border-border px-3.5 py-1.5 text-left text-2xs text-muted-foreground hover:text-foreground"
        >
          {all ? "Show less" : `Show ${g.actions.length - 4} more`}
        </button>
      )}
    </Card>
  );
}
