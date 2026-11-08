/**
 * The composer floats over the bottom of every page, with a fade so content scrolls under it.
 * When one of its menus is open, the fade grows and the page behind blurs so the menu stands apart.
 * Permission prompts waiting for you sit above it.
 */
import { useState } from "react";
import type { ModelSelection } from "../../../../shared/providers.ts";
import type { Chat, ContextRef, DashboardState } from "../../../../shared/types.ts";
import { Composer } from "./Composer.tsx";
import { PermissionCard } from "./PermissionCard.tsx";
import { cn } from "../ui.tsx";
import type { View } from "../../navigation.ts";

export function ComposerDock({
  state,
  view,
  chat,
  pageRef,
  selection,
  onSelect,
  busy,
  onSend,
  onStop,
  focusSignal,
  attach,
}: {
  state: DashboardState;
  view: View;
  chat: Chat | null;
  pageRef: ContextRef | null;
  selection: ModelSelection;
  onSelect: (s: ModelSelection) => void;
  busy: boolean;
  onSend: (text: string, refs: ContextRef[]) => void;
  onStop: () => void;
  focusSignal: number;
  attach: { ref: ContextRef; n: number } | null;
}) {
  const [composerMenu, setComposerMenu] = useState(false);
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5 pb-4 transition-[padding] duration-300 ease-drawer",
        composerMenu ? "pt-80" : "pt-10",
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 backdrop-blur-md transition-opacity duration-300 [mask-image:linear-gradient(to_top,black_60%,transparent)]",
          composerMenu ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="pointer-events-auto relative mx-auto w-full max-w-3xl">
        {state.permissions
          .filter((p) => !(view === "chat" && p.chatId && p.chatId === chat?.id))
          .map((p) => (
            <div key={p.id} className="mb-2">
              <PermissionCard req={p} />
            </div>
          ))}
        <Composer
          state={state}
          pageRef={pageRef}
          selection={selection}
          onSelect={onSelect}
          busy={busy}
          onSend={onSend}
          onStop={onStop}
          focusSignal={focusSignal}
          onMenuChange={setComposerMenu}
          attach={attach}
        />
      </div>
    </div>
  );
}
