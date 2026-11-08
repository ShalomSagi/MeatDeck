// The chat page: streamed replies, tool steps, result cards, history.
/** The chat page: one conversation, full width. The floating prompt box continues it. */
import { History, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { asSelection, EFFORT_LABEL, modelLabel } from "../../../../shared/providers.ts";
import type { Chat, ChatMessage, DashboardState } from "../../../../shared/types.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";
import { RefChip } from "../RefChip.tsx";
import { AssistantTurn } from "./AssistantTurn.tsx";
import { ChatList } from "./ChatList.tsx";
import { ChatRows } from "./ChatRows.tsx";
import { usableProviders } from "./ModelPicker.tsx";
import { PermissionCard } from "./PermissionCard.tsx";
import { UserMessageRow } from "./UserMessageRow.tsx";
import { refKey, refLabel } from "./contextRefs.tsx";
import { Button } from "../ui.tsx";

export function ChatView({
  chat,
  state,
  onNew,
  onOpenChat,
  onOpenNote,
  onGoToday,
}: {
  chat: Chat | null;
  state: DashboardState;
  onNew: () => void;
  onOpenChat: (id: string) => void;
  onOpenNote: (id: string) => void;
  onGoToday: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const last = chat?.messages.at(-1);
  // Follow the reply as it streams (the page itself scrolls, so scroll the end marker into view).
  const lastPart = last?.parts?.at(-1);
  const lastPartSize = lastPart ? (lastPart.kind === "text" ? lastPart.text.length : lastPart.entries.length) : 0;
  // The dependencies are the triggers (the reply grew, a permission prompt appeared), not inputs.
  /* oxlint-disable react/exhaustive-effect-dependencies -- trigger-only dependencies */
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [
    chat?.id,
    chat?.messages.length,
    last?.text,
    last?.steps?.length,
    last?.parts?.length,
    lastPartSize,
    last?.status,
    state.permissions.length,
  ]);
  /* oxlint-enable react/exhaustive-effect-dependencies */

  if (!chat) return <ChatList state={state} onOpenChat={onOpenChat} />;

  const context = chat.context ?? [];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div className="mb-6 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ProviderIcon provider={chat.provider ?? "claude"} />
            <h2 className="truncate text-base font-semibold">{chat.title}</h2>
            <RefChip id={chat.ref} />
          </div>
          {context.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
              <span>Context:</span>
              {context.map((r) => {
                const { label, icon } = refLabel(r, state);
                return (
                  <span
                    key={refKey(r)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 [&_svg]:size-3"
                  >
                    {icon}
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="relative">
          <Button size="xs" variant="ghost-muted" onClick={() => setHistoryOpen((o) => !o)}>
            <History /> History
          </Button>
          {historyOpen && (
            <div className="absolute top-full right-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl">
              <ChatRows
                state={state}
                activeId={chat.id}
                onOpen={(id) => {
                  setHistoryOpen(false);
                  onOpenChat(id);
                }}
              />
            </div>
          )}
        </div>
        <Button size="xs" variant="outline" onClick={onNew}>
          <Plus /> New chat
        </Button>
      </div>

      <div className="flex flex-col">
        {chat.messages.map((m, i) =>
          m.role === "user" ? (
            <UserTurn key={m.id} m={m} state={state} />
          ) : (
            <AssistantTurn
              key={m.id}
              m={m}
              last={i === chat.messages.length - 1}
              docs={state.notes}
              provider={chat.provider ?? "claude"}
              model={`${modelLabel(asSelection(chat.model, chat.provider), usableProviders(state.providers))}${chat.effort ? ` · ${EFFORT_LABEL[chat.effort] ?? chat.effort}` : ""}`}
              onOpenNote={onOpenNote}
              onGoToday={onGoToday}
            />
          ),
        )}
        {/* This chat is paused until you answer. */}
        <div className="flex flex-col gap-2">
          {state.permissions
            .filter((p) => p.chatId === chat.id)
            .map((p) => (
              <PermissionCard key={p.id} req={p} compact />
            ))}
        </div>
      </div>
      <div ref={bottom} className="h-px" />
    </div>
  );
}

function UserTurn({ m, state }: { m: ChatMessage; state: DashboardState }) {
  return <UserMessageRow m={m} state={state} />;
}
