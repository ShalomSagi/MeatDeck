import { Plus, Sunrise } from "lucide-react";
import { useState } from "react";
import type { Action } from "../../../../shared/actions.ts";
import type { DashboardState, Project } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ActionQueue } from "../queue/ActionQueue.tsx";
import { Suggestions } from "./Suggestions.tsx";
import { Card, Empty } from "../ui.tsx";
import { agoText, greeting } from "../../lib.ts";

export function TodayView({
  state,
  queue,
  onOpenNote,
  onOpenProject,
}: {
  state: DashboardState;
  queue: { open: Action[]; done: Action[] };
  onOpenNote: (id: string) => void;
  onOpenProject: (p: Project) => void;
}) {
  const { day } = state;
  const [showHighlights, setShowHighlights] = useState(false);
  const [draft, setDraft] = useState("");
  const count = (t: Action["tier"]) => queue.open.filter((a) => a.tier === t).length;
  const theirs = queue.open.filter((a) => a.ball === "them").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xl font-semibold tracking-tight">{greeting()}.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {count("now") > 0 ? (
            <>
              <span className="font-medium text-foreground">{count("now")} to do now</span>
              {count("today") > 0 && ` · ${count("today")} more today`}
            </>
          ) : count("today") > 0 ? (
            <span className="font-medium text-foreground">{count("today")} things for today</span>
          ) : (
            "Nothing urgent right now"
          )}
          {theirs > 0 && ` · ${theirs} waiting on others`}
        </p>
        {day.brief ? (
          <Card className="mt-3 px-4 py-3">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
              Claude's brief{" "}
              <span className="font-normal text-muted-foreground/70">· {agoText(day.brief.generatedAt)}</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-foreground/90">{day.brief.summary}</p>
            {day.brief.highlights.length > 0 && (
              <>
                {showHighlights && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {day.brief.highlights.map((h) => (
                      <li key={h} className="flex gap-2 text-sm leading-5 text-foreground/85">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setShowHighlights((v) => !v)}
                  className="mt-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                >
                  {showHighlights ? "Hide details" : `${day.brief.highlights.length} details`}
                </button>
              </>
            )}
          </Card>
        ) : (
          <Card className="mt-3 flex items-center gap-3 px-4 py-3">
            <Sunrise className="size-5 text-warning" />
            <div className="text-sm">
              <p className="font-medium">
                {state.run?.status === "running" ? `${state.run.label} in progress…` : "No brief yet today"}
              </p>
              <p className="text-xs text-muted-foreground">
                {state.settings.morning.enabled
                  ? `Claude writes it from ${state.settings.morning.time} on work days. `
                  : ""}
                The list below already reflects GitHub right now.
              </p>
            </div>
          </Card>
        )}
      </div>

      <Suggestions suggestions={state.suggestions ?? []} onOpenProject={onOpenProject} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          setDraft("");
          void api.addTodo(t);
        }}
        className="-mb-2 flex h-9 items-center gap-2 rounded-lg border border-dashed border-border px-3 focus-within:border-ring/50 focus-within:border-solid"
      >
        <Plus className="size-4 text-muted-foreground" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add something you need to do…"
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </form>

      <ActionQueue
        actions={queue.open}
        done={queue.done}
        withDone
        state={state}
        onOpenNote={onOpenNote}
        empty={
          <Card>
            <Empty
              title="Nothing needs you right now"
              hint="New review requests, replies and drafts show up here as they happen."
            />
          </Card>
        }
      />
    </div>
  );
}
