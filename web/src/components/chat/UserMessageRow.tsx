/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineUserMessageRow.tsx (user bubble + hover actions)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import type { ChatMessage, DashboardState } from "../../../../shared/types.ts";
import { ContextChip } from "./ContextChip.tsx";
import { MessageCopyButton } from "./MessageCopyButton.tsx";
import { Timestamp } from "./Timestamp.tsx";
import { refKey } from "./contextRefs.tsx";

export function UserMessageRow({ m, state }: { m: ChatMessage; state: DashboardState }) {
  const context = m.context ?? [];
  return (
    <div className="group flex flex-col items-end gap-1 pb-4">
      <div className="relative max-w-[80%] min-w-0 rounded-2xl bg-accent p-3 text-foreground dark:bg-white/[0.07]">
        <h3 className="sr-only select-none">You</h3>
        {context.length > 0 && (
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {context.map((r) => (
              <ContextChip key={refKey(r)} r={r} state={state} />
            ))}
          </div>
        )}
        <div dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {m.text}
        </div>
      </div>
      <div className="flex w-full max-w-[80%] items-center justify-end pe-1 text-xs tabular-nums opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
        <div className="flex shrink-0 items-center gap-2">
          <Timestamp iso={m.at} />
          <MessageCopyButton text={m.text} />
        </div>
      </div>
    </div>
  );
}
