import { Play, Zap } from "lucide-react";
import type { DashboardState } from "../../../../shared/types.ts";
import { clock } from "../runs/runKinds.tsx";
import { RunRow } from "./RunRow.tsx";
import { Card, SectionHeader } from "../ui.tsx";
import { uniqueKeys } from "../../lib.ts";

export function ActivitySettings({ state, onOpenLog }: { state: DashboardState; onOpenLog: (id: string) => void }) {
  const events = state.events.slice(0, 12);
  const eventKeys = uniqueKeys(events, (e) => `${e.at} ${e.text}`);
  return (
    <div className="flex flex-col gap-6">
      <section id="setting-noticed">
        <SectionHeader
          title="Noticed by code"
          icon={<Zap />}
          count={state.events.length}
          action={
            <span className="text-2xs text-muted-foreground/70">
              Tracked without Claude, so no tokens. Handed to the next run.
            </span>
          }
        />
        <Card className="divide-y divide-border overflow-hidden">
          {state.events.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Nothing yet. GitHub changes show up here as they happen.
            </p>
          )}
          {events.map((e, i) => (
            <a
              key={eventKeys[i]}
              href={e.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-accent/60"
            >
              <span className="flex-1 truncate">{e.text}</span>
              <span className="text-2xs tabular-nums text-muted-foreground/70">{clock(e.at)}</span>
            </a>
          ))}
        </Card>
      </section>

      <section id="setting-runs">
        <SectionHeader title="Runs" icon={<Play />} count={state.runs.length} />
        <Card className="divide-y divide-border overflow-hidden">
          {state.runs.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">No runs yet.</p>}
          {state.runs.slice(0, 20).map((r) => (
            <RunRow key={r.id} run={r} onOpen={() => onOpenLog(r.id)} />
          ))}
        </Card>
      </section>
    </div>
  );
}
