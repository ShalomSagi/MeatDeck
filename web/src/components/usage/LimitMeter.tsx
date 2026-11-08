import type { UsageLimits } from "../../../../shared/types.ts";
import { clock } from "../runs/runKinds.tsx";
import { cn } from "../ui.tsx";
import { fmtPct, PACE_LABEL, paceOf } from "./Usage.logic.ts";
import { useMinuteClock } from "./useMinuteClock.ts";

export function LimitMeter({ w, compact = false }: { w: UsageLimits["windows"][number]; compact?: boolean }) {
  const now = useMinuteClock();
  const used = Math.max(0, Math.min(100, w.usedPercent));
  const tone = used >= 90 ? "bg-destructive" : used >= 80 ? "bg-warning" : "bg-foreground/70";
  const pace = paceOf(w, now);
  return (
    <div
      className={cn(
        "grid min-w-0 items-center",
        compact
          ? "grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 text-2xs"
          : "grid-cols-[6.5rem_1fr_auto] gap-x-3 text-xs",
      )}
      title={`${w.label}: ${used}% used${w.resetsAt ? ` · resets ${clock(w.resetsAt)}` : ""}${pace ? ` · ${PACE_LABEL[pace]}` : ""}`}
    >
      <span className="truncate text-muted-foreground">
        {compact ? (w.id === "five_hour" ? "5h" : "Week") : w.label}
      </span>
      <div
        className={cn("overflow-hidden rounded-full bg-accent", compact ? "h-1" : "h-1.5")}
        role="meter"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${w.label} usage`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tone)}
          style={{ width: `${Math.max(used, 1.5)}%` }}
        />
      </div>
      <span className="text-right tabular-nums text-foreground/85">{fmtPct(used)}</span>
    </div>
  );
}
