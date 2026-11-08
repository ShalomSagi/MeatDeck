/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineAssistantRows.tsx (assistant row)
 *   apps/web/src/components/chat/MessagesTimeline.tsx (TimelineRowContent row spacing)
 *   apps/web/src/components/ChatMarkdown.tsx (prose container classes)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import type { ReactNode } from "react";
import type { ProviderId } from "../../../../shared/providers.ts";
import type { ChatMessage } from "../../../../shared/types.ts";
import { Markdown } from "../Markdown.tsx";
import { AssistantMessageMeta } from "./AssistantMessageMeta.tsx";
import { assistantCopyText, legacyParts, partKeys } from "./AssistantTimeline.logic.ts";
import { TimelineWorkGroup } from "./TimelineWorkGroup.tsx";
import { WorkingRow } from "./WorkingRow.tsx";
import { cn } from "../ui.tsx";

const PROSE_CLASS =
  "flex w-full min-w-0 flex-col gap-2.5 text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere] [word-break:break-word]";

function AssistantText({ text }: { text: string }) {
  return (
    <div className="relative min-w-0 px-1 py-0.5 pb-2">
      <Markdown text={text} className={PROSE_CLASS} />
    </div>
  );
}

/** One assistant turn: text and tool calls in order, then the live row or the meta line. */
export function AssistantTimeline({
  m,
  provider,
  model,
  last,
  children,
}: {
  m: ChatMessage;
  provider: ProviderId;
  model: string;
  /** The newest turn keeps its meta line visible (T3's assistant-meta row). */
  last?: boolean;
  /** Result cards, rendered after the turn's content. */
  children?: ReactNode;
}) {
  const working = m.status === "running";
  const legacy = m.parts ? null : legacyParts(m);
  const parts = m.parts ?? legacy!.parts;
  const keys = partKeys(parts);
  const copyText = assistantCopyText(m);
  return (
    <div className={cn("group/assistant flex flex-col", !working && "pb-4")}>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          p.text.trim() ? (
            <AssistantText key={keys[i]} text={p.text} />
          ) : null
        ) : (
          <TimelineWorkGroup key={keys[i]} entries={p.entries} presentations={legacy?.presentations} />
        ),
      )}
      {!working && parts.length === 0 && (
        <div className="px-1 py-0.5 pb-2 text-sm text-muted-foreground italic">(empty response)</div>
      )}
      {children ? <div className="flex flex-col gap-2 pb-2">{children}</div> : null}
      {working ? (
        <WorkingRow since={m.at} />
      ) : (
        <AssistantMessageMeta m={m} provider={provider} model={model} copyText={copyText} alwaysVisible={last} />
      )}
    </div>
  );
}
