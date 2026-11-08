/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineWorkGroupRows.tsx (group header)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
/** One run of tool calls between two pieces of text. Several finished calls fold behind a summary row. */
import { X } from "lucide-react";
import { useState } from "react";
import type { WorkEntry } from "../../../../shared/types.ts";
import { summarizeGroup } from "./TimelineWorkGroup.logic.ts";
import { WorkEntryIcon } from "./WorkEntryIcon.tsx";
import { type EntryPresentation, presentEntry } from "./WorkEntryRow.logic.ts";
import { failedToolIconClassName, WorkEntryRow } from "./WorkEntryRow.tsx";
import { WorkLogBlock, WorkLogButton } from "./WorkLog.tsx";
import { elapsedBetween } from "./elapsed.ts";
import { cn } from "../ui.tsx";

export function TimelineWorkGroup({
  entries,
  presentations,
}: {
  entries: WorkEntry[];
  presentations?: EntryPresentation[];
}) {
  const items = presentations ?? entries.map((e) => presentEntry(e));
  const live = entries.some((e) => e.status === "running");
  const [override, setOverride] = useState<boolean | null>(null);
  if (entries.length === 0) return null;
  if (entries.length === 1)
    return (
      <WorkLogBlock>
        <section aria-label="Activity">
          <WorkEntryRow entry={entries[0]} p={items[0]} />
        </section>
      </WorkLogBlock>
    );
  const expanded = override ?? live;
  const { summary, icon } = summarizeGroup(items);
  const failed = entries.some((e) => e.status === "error");
  const ended = entries.reduce<number>((max, e) => Math.max(max, e.endedAt ? Date.parse(e.endedAt) : 0), 0);
  const elapsed = !live && ended ? elapsedBetween(entries[0].at, ended) : null;
  return (
    <WorkLogBlock>
      <WorkLogButton
        aria-label={failed ? `${summary}, tool call failed` : summary}
        aria-expanded={expanded}
        onClick={() => setOverride(!expanded)}
        icon={
          <WorkEntryIcon
            name={icon}
            className={cn("size-4 shrink-0 stroke-2", failed ? failedToolIconClassName : "text-muted-foreground/80")}
          />
        }
        label={<span className="block truncate">{summary}</span>}
        trailing={
          <span className="flex shrink-0 items-center gap-1.5">
            {elapsed && (
              <span className="pointer-events-none text-xs text-muted-foreground tabular-nums opacity-0 group-hover/timeline-row:opacity-100 group-focus-within/timeline-row:opacity-100">
                {elapsed}
              </span>
            )}
            {failed ? <X aria-hidden className={cn("size-3 shrink-0", failedToolIconClassName)} /> : null}
          </span>
        }
      />
      {expanded ? (
        <div
          role="region"
          aria-label="Tool calls"
          className="flex max-h-[min(18rem,50dvh)] min-w-0 flex-col overflow-x-hidden overflow-y-auto rounded-md"
        >
          {entries.map((e, i) => (
            <WorkEntryRow key={e.id} entry={e} p={items[i]} />
          ))}
        </div>
      ) : null}
    </WorkLogBlock>
  );
}
