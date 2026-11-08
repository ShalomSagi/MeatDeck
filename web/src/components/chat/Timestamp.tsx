/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineRowParts.tsx (hover timestamp)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
/** Time today, otherwise "Nov 3, 4:05 PM" (T3's formatDayAwareTimestamp). */
import { cn } from "../ui.tsx";

function formatDayAwareTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

export function Timestamp({ iso, className }: { iso: string; className?: string }) {
  return (
    <span
      title={new Date(iso).toLocaleString()}
      className={cn("text-xs text-muted-foreground tabular-nums", className)}
    >
      {formatDayAwareTimestamp(iso)}
    </span>
  );
}
