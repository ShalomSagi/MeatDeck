import { Bot } from "lucide-react";
import type { DashboardState, Settings } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ClaudeModelSelect } from "./ClaudeModelSelect.tsx";
import { LoginItemRow } from "./LoginItemRow.tsx";
import { UpdatesRow } from "./UpdatesRow.tsx";
import { Card, SectionHeader } from "../ui.tsx";
import { desktop } from "../../desktop.ts";

export function GeneralSettings({ state }: { state: DashboardState }) {
  const s = state.settings;
  const patch = (p: Partial<Settings>) => api.updateSettings(p);
  return (
    <section>
      <SectionHeader title="Models for runs" icon={<Bot />} />
      <Card className="divide-y divide-border">
        <div id="setting-model" className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Model</p>
            <p className="text-xs text-muted-foreground">
              Morning brief, wrap-up and sending. Leave blank to use your Claude Code default.
            </p>
          </div>
          <ClaudeModelSelect providers={state.providers} value={s.model} onChange={(model) => patch({ model })} />
        </div>
        <div id="setting-small-model" className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Small model</p>
            <p className="text-xs text-muted-foreground">
              For frequent or narrow runs: pulse checks and Change requests.
            </p>
          </div>
          <ClaudeModelSelect
            providers={state.providers}
            value={s.pulseModel}
            onChange={(pulseModel) => patch({ pulseModel })}
          />
        </div>
        <div id="setting-idle" className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Skip while away</p>
            <p className="text-xs text-muted-foreground">
              No pulses or wrap-ups after this long without keyboard or mouse input. They run once you're back. The
              morning brief always runs.
            </p>
          </div>
          <select
            value={s.skipWhenIdleMinutes}
            onChange={(e) => patch({ skipWhenIdleMinutes: Number(e.target.value) })}
            className="h-7 rounded-md border border-input bg-popover px-1.5 text-xs dark:bg-input/32"
          >
            {[0, 10, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "never skip" : `${m} min idle`}
              </option>
            ))}
          </select>
        </div>
        {desktop && <LoginItemRow />}
        <UpdatesRow state={state} />
      </Card>
    </section>
  );
}
