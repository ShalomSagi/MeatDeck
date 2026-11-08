/** Bottom drawer with a Claude run's log, styled like T3's terminal drawer.
 *  Shows the live run, or a past one when `runId` points at it. */
import { ChevronDown, LoaderCircle, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ClaudeRun } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { Button, cn } from "../ui.tsx";
import { agoText } from "../../lib.ts";

export function RunPanel({
  live,
  runs,
  runId,
  open,
  onClose,
}: {
  live?: ClaudeRun;
  runs: Omit<ClaudeRun, "log">[];
  runId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const [pastLog, setPastLog] = useState<string>("");
  const showingLive = !runId || runId === live?.id;
  const run = showingLive ? live : runs.find((r) => r.id === runId);
  const log = showingLive ? live?.log : pastLog;

  useEffect(() => {
    if (!showingLive && runId && open) void api.runLog(runId).then(setPastLog);
  }, [runId, showingLive, open]);

  // Follow the log as it grows, and jump to its end on open.
  useEffect(() => {
    if (open && log) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log, open]);

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-40 flex h-80 flex-col border-t border-border bg-card shadow-[0_-12px_32px_-18px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-drawer",
        open ? "translate-y-0" : "invisible translate-y-full",
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        {run?.status === "running" ? (
          <LoaderCircle className="size-3.5 animate-spin text-primary" />
        ) : (
          <TerminalSquare className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-medium">{run?.label ?? "Claude"}</span>
        {run && (
          <span className="text-2xs text-muted-foreground">
            {run.status} · {run.trigger === "schedule" ? "scheduled" : "by you"} · started {agoText(run.startedAt)}
          </span>
        )}
        <Button variant="ghost-muted" size="icon-xs" className="ml-auto" onClick={onClose} aria-label="Close">
          <ChevronDown />
        </Button>
      </div>
      <pre
        ref={ref}
        className="flex-1 overflow-auto px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap text-foreground/85"
      >
        {log || "No run yet."}
      </pre>
    </div>
  );
}
