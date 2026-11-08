import { Check, ChevronRight, CircleX, LoaderCircle } from "lucide-react";
import type { ClaudeRun } from "../../../../shared/types.ts";
import { clock, KIND_META } from "../runs/runKinds.tsx";
import { Badge } from "../ui.tsx";
import { fmtTokens } from "../../lib.ts";

export function RunRow({ run, onOpen }: { run: Omit<ClaudeRun, "log">; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60"
    >
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{KIND_META[run.kind]?.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{run.label}</span>
          {run.status === "running" && (
            <Badge variant="primary">
              <LoaderCircle className="animate-spin" /> running
            </Badge>
          )}
          {run.status === "failed" && (
            <Badge variant="error">
              <CircleX /> failed
            </Badge>
          )}
          {run.status === "done" && <Check className="size-3.5 text-success" />}
          <span className="text-2xs text-muted-foreground">
            {run.trigger === "schedule" ? "scheduled" : run.trigger === "you" ? "by you" : "on launch"}
          </span>
          {run.usage && (
            <span
              className="text-2xs tabular-nums text-muted-foreground"
              title={`${run.usage.output.toLocaleString()} output · ${run.usage.cacheRead.toLocaleString()} cache read · ${run.usage.models.join(", ")}`}
            >
              · {fmtTokens(run.usage.total)} tokens
            </span>
          )}
        </div>
        {run.summary && <p className="mt-0.5 truncate text-xs text-muted-foreground">{run.summary}</p>}
      </div>
      <span className="mt-0.5 text-2xs tabular-nums text-muted-foreground/70">{clock(run.startedAt)}</span>
      <ChevronRight className="mt-0.5 size-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </button>
  );
}
