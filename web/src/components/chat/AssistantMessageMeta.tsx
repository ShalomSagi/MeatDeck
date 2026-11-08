/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineAssistantRows.tsx (AssistantMessageMeta)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import type { ProviderId } from "../../../../shared/providers.ts";
import type { ChatMessage } from "../../../../shared/types.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";
import { MessageCopyButton } from "./MessageCopyButton.tsx";
import { Timestamp } from "./Timestamp.tsx";
import { cn } from "../ui.tsx";
import { fmtTokens } from "../../lib.ts";

export function AssistantMessageMeta({
  m,
  provider,
  model,
  copyText,
  alwaysVisible = false,
}: {
  m: ChatMessage;
  provider: ProviderId;
  model: string;
  copyText: string;
  alwaysVisible?: boolean;
}) {
  const statusLabel = m.status === "stopped" ? "stopped" : m.status === "failed" ? "failed" : null;
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 px-1 text-xs tabular-nums transition-opacity duration-200",
        alwaysVisible
          ? "opacity-100"
          : "opacity-0 focus-within:opacity-100 group-hover/assistant:opacity-100 pointer-coarse:opacity-100",
      )}
    >
      {statusLabel ? (
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 font-mono text-3xs",
            m.status === "failed"
              ? "border-destructive/30 text-destructive-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
      ) : null}
      {copyText ? <MessageCopyButton text={copyText} /> : null}
      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
        <ProviderIcon provider={provider} className="size-3" />
        <span className="truncate">{model}</span>
        {m.usage ? <span className="shrink-0">· {fmtTokens(m.usage.tokens)} tokens</span> : null}
      </span>
      <Timestamp iso={m.finishedAt ?? m.at} />
    </div>
  );
}
