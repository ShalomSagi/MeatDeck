/** No chat open: recent chats, newest first. */
import type { DashboardState } from "../../../../shared/types.ts";
import { ChatRows } from "./ChatRows.tsx";

export function ChatList({ state, onOpenChat }: { state: DashboardState; onOpenChat: (id: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {state.chats.length === 0 ? (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground/80">Ask anything</p>
          <p className="mx-auto mt-1 max-w-80 text-xs leading-5">
            Type in the box below from any page. A new chat opens here, and it remembers the page you started it from.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-1">
          <ChatRows state={state} onOpen={onOpenChat} />
        </div>
      )}
    </div>
  );
}
