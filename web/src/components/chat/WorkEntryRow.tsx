/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineWorkEntryRow.tsx (entry row, failure styling)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import { LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import type { WorkEntry } from "../../../../shared/types.ts";
import { WorkEntryIcon } from "./WorkEntryIcon.tsx";
import { type EntryPresentation, presentEntry } from "./WorkEntryRow.logic.ts";
import { WorkLogDetails, WorkLogRow } from "./WorkLog.tsx";
import { elapsedBetween } from "./elapsed.ts";
import { useNow } from "./useNow.ts";
import { cn } from "../ui.tsx";

export const failedToolIconClassName = "text-destructive/60";

export function WorkEntryRow({ entry, p = presentEntry(entry) }: { entry: WorkEntry; p?: EntryPresentation }) {
  const [expanded, setExpanded] = useState(false);
  const running = entry.status === "running";
  const failed = entry.status === "error";
  const now = useNow(running);
  const elapsed = elapsedBetween(entry.at, running ? now : entry.endedAt ? Date.parse(entry.endedAt) : NaN);
  const canExpand = Boolean(p.detail || entry.error);
  const toggle = () => setExpanded((x) => !x);
  return (
    <WorkLogRow
      {...(canExpand
        ? {
            role: "button",
            tabIndex: 0,
            "aria-expanded": expanded,
            "aria-label": failed ? `${p.label}, tool call failed` : p.label,
            onClick: toggle,
            onKeyDown: (e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                toggle();
              }
            },
          }
        : {})}
      icon={
        <span
          className={cn(
            "flex size-4 items-center justify-center",
            failed ? failedToolIconClassName : running ? "text-foreground" : "text-muted-foreground/80",
          )}
          role={failed ? "img" : undefined}
          aria-label={failed ? "Tool call failed" : undefined}
        >
          <WorkEntryIcon name={p.icon} className="block size-4 shrink-0 stroke-2" />
        </span>
      }
      label={
        <p className="flex w-full min-w-0 items-baseline gap-1.5 text-sm leading-relaxed">
          <span className={cn("shrink-0", running ? "animate-pulse text-foreground" : "text-muted-foreground")}>
            {p.label}
          </span>
          {p.detail && !expanded ? (
            <span dir="auto" className="min-w-0 truncate text-muted-foreground/70">
              {p.detail}
            </span>
          ) : null}
        </p>
      }
      trailing={
        <span className="flex shrink-0 items-center gap-1.5">
          {elapsed && (
            <span
              className={cn(
                "text-xs text-muted-foreground tabular-nums",
                !running &&
                  "pointer-events-none opacity-0 group-hover/timeline-row:opacity-100 group-focus-within/timeline-row:opacity-100",
              )}
            >
              {elapsed}
            </span>
          )}
          {running ? <LoaderCircle className="size-3 shrink-0 animate-spin text-muted-foreground" /> : null}
          {failed ? <X aria-hidden className={cn("size-3 shrink-0", failedToolIconClassName)} /> : null}
        </span>
      }
    >
      {failed && entry.error && !expanded ? (
        <p className="ms-7 line-clamp-2 py-0.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-destructive-foreground/90">
          {entry.error}
        </p>
      ) : null}
      {expanded ? (
        <WorkLogDetails>
          {p.detail ? (
            <pre className="font-mono text-xs leading-5 break-words whitespace-pre-wrap text-foreground/80">
              {p.detail}
            </pre>
          ) : null}
          {entry.error ? (
            <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-destructive-foreground">
              {entry.error}
            </p>
          ) : null}
        </WorkLogDetails>
      ) : null}
    </WorkLogRow>
  );
}
