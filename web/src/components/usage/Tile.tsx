import type { ReactNode } from "react";
import { cn } from "../ui.tsx";

export function Tile({
  label,
  value,
  sub,
  swatch,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  swatch?: "meatdeck" | "other";
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        {swatch && (
          <span
            className={cn("size-2 rounded-[2px]", swatch === "meatdeck" ? "bg-series-meatdeck" : "bg-series-other")}
          />
        )}
        {label}
      </div>
      <div className="mt-0.5 text-xl leading-7 font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
