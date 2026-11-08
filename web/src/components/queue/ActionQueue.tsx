// The action queue UI: one ranked list of next moves, grouped by urgency (Now / Today / Watch).
// Each row: a verb, why, whose move it is, and the one button that does it.
import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Action, Tier } from "../../../../shared/actions.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ActionRow } from "./ActionRow.tsx";
import { Button, Card, cn } from "../ui.tsx";

const TIERS: { tier: Tier; title: string; hint: string }[] = [
  { tier: "now", title: "Now", hint: "Do these first" },
  { tier: "today", title: "Today", hint: "Should happen today" },
  { tier: "watch", title: "Watching", hint: "Fine to wait. They become nudges when it's time." },
];

const NO_ACTIONS: Action[] = [];

export function ActionQueue({
  actions,
  done = NO_ACTIONS,
  state,
  onOpenNote,
  hideProject,
  empty,
  withDone,
}: {
  actions: Action[];
  done?: Action[];
  /** Today: also list what you dismissed, with Restore. */
  withDone?: boolean;
  state: DashboardState;
  onOpenNote: (id: string) => void;
  hideProject?: boolean;
  empty?: ReactNode;
}) {
  const [showDone, setShowDone] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  // Shown where the day's "Done" list is (Today): recent dismissals, newest first, with Restore.
  const dismissed = withDone
    ? Object.values(state.dismissed ?? {})
        .filter((d) => !d.done)
        .sort((x, y) => y.at.localeCompare(x.at))
        .slice(0, 30)
    : [];
  if (!actions.length && !done.length && !dismissed.length) return <>{empty}</>;
  return (
    <div className="flex flex-col gap-5">
      {TIERS.map(({ tier, title, hint }) => {
        const rows = actions.filter((a) => a.tier === tier);
        if (!rows.length) return null;
        return (
          <section key={tier}>
            <div className="mb-1.5 flex items-baseline gap-2 px-1">
              <h2
                className={cn(
                  "text-xs font-semibold tracking-wide uppercase",
                  tier === "now" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {title}
              </h2>
              <span className="text-2xs tabular-nums text-muted-foreground/70">{rows.length}</span>
              <span className="ml-auto text-2xs text-muted-foreground/60">{hint}</span>
            </div>
            <Card className={cn("divide-y divide-border overflow-hidden", tier === "now" && "border-foreground/15")}>
              {rows.map((a) => (
                <ActionRow key={a.key} a={a} state={state} onOpenNote={onOpenNote} hideProject={hideProject} />
              ))}
            </Card>
          </section>
        );
      })}
      {done.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex cursor-pointer items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", showDone && "rotate-90")} />
            Done today <span className="font-normal tabular-nums">{done.length}</span>
          </button>
          {showDone && (
            <Card className="mt-1.5 divide-y divide-border overflow-hidden">
              {done.map((a) => (
                <div key={a.key} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                  <button
                    type="button"
                    title="Reopen"
                    onClick={() =>
                      a.markedDone
                        ? void api.restoreAction(a.key)
                        : a.todoId && void api.updateTodo(a.todoId, { status: "open" })
                    }
                    className="flex size-4 cursor-pointer items-center justify-center rounded-[4px] border border-success bg-success text-white"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                  <span className="truncate line-through decoration-muted-foreground/50">{a.title}</span>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
      {dismissed.length > 0 && (
        <section className="-mt-3">
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="flex cursor-pointer items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", showDismissed && "rotate-90")} />
            Dismissed <span className="font-normal tabular-nums">{dismissed.length}</span>
          </button>
          {showDismissed && (
            <Card className="mt-1.5 divide-y divide-border overflow-hidden">
              {dismissed.map((d) => (
                <div key={d.key} className="group flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                  <X className="size-3.5 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="shrink-0 text-2xs opacity-70">
                    {new Date(d.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => void api.restoreAction(d.key)}
                  >
                    <RotateCcw /> Restore
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
