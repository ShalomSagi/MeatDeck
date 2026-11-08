/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineWorkGroupRows.tsx (WorkingTimelineRow)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
/** "Working for 12s" at the foot of a running turn (T3's WorkingTimelineRow). */
import { LoaderCircle } from "lucide-react";
import { elapsedBetween } from "./elapsed.ts";
import { useNow } from "./useNow.ts";

export function WorkingRow({ since }: { since: string }) {
  const now = useNow(true);
  const elapsed = elapsedBetween(since, now);
  return (
    <div className="pt-1 pb-1.5">
      <div className="flex h-6 min-w-0 items-center gap-2 px-1 text-sm leading-relaxed text-muted-foreground tabular-nums">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
        <span className="animate-pulse whitespace-nowrap">{elapsed ? <>Working for {elapsed}</> : "Working…"}</span>
      </div>
    </div>
  );
}
