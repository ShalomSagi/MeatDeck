import { CalendarClock, Sunrise, Sunset, Timer } from "lucide-react";
import type { DashboardState, Settings } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ScheduleRow } from "./ScheduleRow.tsx";
import { TimeInput } from "./TimeInput.tsx";
import { Card, cn, SectionHeader } from "../ui.tsx";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ScheduleSettings({ state }: { state: DashboardState }) {
  const s = state.settings;
  const patch = (p: Partial<Settings>) => api.updateSettings(p);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeader title="Schedule" icon={<CalendarClock />} />
        <Card className="divide-y divide-border">
          <ScheduleRow
            id="setting-morning"
            icon={<Sunrise />}
            title="Morning brief"
            hint="Full /today run: checks GitHub, Linear and Slack, then writes the brief, todos, board and drafts. If the Mac was asleep, it runs as soon as it wakes."
            enabled={s.morning.enabled}
            onToggle={(enabled) => patch({ morning: { ...s.morning, enabled } })}
            onRun={() => api.runClaude("manual")}
          >
            <TimeInput value={s.morning.time} onChange={(time) => patch({ morning: { ...s.morning, time } })} />
            <div className="flex gap-0.5">
              {DAYS.map((d, i) => {
                const on = s.morning.days.includes(i);
                return (
                  <button
                    key={DAY_NAMES[i]}
                    type="button"
                    title={DAY_NAMES[i]}
                    onClick={() =>
                      patch({
                        morning: {
                          ...s.morning,
                          days: on ? s.morning.days.filter((x) => x !== i) : [...s.morning.days, i].sort(),
                        },
                      })
                    }
                    className={cn(
                      "size-6 cursor-pointer rounded-md text-2xs font-medium transition-colors",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </ScheduleRow>
          <ScheduleRow
            id="setting-pulse"
            icon={<Timer />}
            title="Pulse checks"
            hint="A cheap pass for what changed since the last run: new mentions, replies, PR state, drafts that became moot."
            enabled={s.pulse.enabled}
            onToggle={(enabled) => patch({ pulse: { ...s.pulse, enabled } })}
            onRun={() => api.runClaude("pulse")}
          >
            <span className="text-xs text-muted-foreground">every</span>
            <select
              value={s.pulse.everyMinutes}
              onChange={(e) => patch({ pulse: { ...s.pulse, everyMinutes: Number(e.target.value) } })}
              className="h-7 rounded-md border border-input bg-popover px-1.5 text-xs dark:bg-input/32"
            >
              {[30, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : `${m / 60} h`}
                </option>
              ))}
            </select>
            <TimeInput value={s.pulse.from} onChange={(from) => patch({ pulse: { ...s.pulse, from } })} />
            <span className="text-xs text-muted-foreground">–</span>
            <TimeInput value={s.pulse.to} onChange={(to) => patch({ pulse: { ...s.pulse, to } })} />
          </ScheduleRow>
          <ScheduleRow
            id="setting-wrapup"
            icon={<Sunset />}
            title="Wrap-up"
            hint="Closes todos that evidently got done, lists what carries over, drafts the replies you still owe."
            enabled={s.wrapup.enabled}
            onToggle={(enabled) => patch({ wrapup: { ...s.wrapup, enabled } })}
            onRun={() => api.runClaude("wrapup")}
          >
            <TimeInput value={s.wrapup.time} onChange={(time) => patch({ wrapup: { ...s.wrapup, time } })} />
          </ScheduleRow>
        </Card>
        <p className="mt-2 px-1 text-2xs leading-4 text-muted-foreground">
          Scheduled runs only read and draft. The only thing that sends a message is you pressing Send on it.
        </p>
      </section>
    </div>
  );
}
