import { cn } from "../ui.tsx";
import { fmtTokens } from "../../lib.ts";

export function BarList({ rows }: { rows: { label: string; value: number; meatdeck: boolean; hint?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-xs">
          <span className={cn("truncate", r.meatdeck ? "font-medium" : "text-foreground/85")} title={r.label}>
            {r.label}
          </span>
          <div className="h-2.5">
            <div
              className={cn("h-full rounded-r-[4px]", r.meatdeck ? "bg-series-meatdeck" : "bg-series-other")}
              style={{ width: `${Math.max(0.6, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-right tabular-nums text-muted-foreground">{fmtTokens(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
