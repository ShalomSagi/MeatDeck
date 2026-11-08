import { LoaderCircle, Trash2 } from "lucide-react";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";
import { refLabel } from "./contextRefs.tsx";
import { cn } from "../ui.tsx";
import { agoText } from "../../lib.ts";

export function ChatRows({
  state,
  activeId,
  onOpen,
}: {
  state: DashboardState;
  activeId?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      {state.chats.map((c) => (
        <div
          key={c.id}
          className={cn("group flex items-center gap-1 rounded-md hover:bg-accent", c.id === activeId && "bg-accent")}
        >
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex min-w-0 flex-1 cursor-pointer flex-col items-start px-2.5 py-1.5 text-left"
          >
            <span className="flex w-full items-center gap-1.5 text-sm">
              {c.running ? (
                <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" />
              ) : (
                <ProviderIcon provider={c.provider ?? "claude"} className="size-3" />
              )}
              <span className="truncate">{c.title}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
              {agoText(c.updatedAt)} · {Math.ceil(c.messageCount / 2)} turns
              {c.context?.[0] && <span className="truncate">· {refLabel(c.context[0], state).label}</span>}
            </span>
          </button>
          <button
            type="button"
            aria-label="Delete chat"
            title="Delete chat"
            onClick={() => void api.deleteChat(c.id)}
            className="mr-1 hidden size-6 cursor-pointer items-center justify-center rounded text-muted-foreground group-hover:flex hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </>
  );
}
