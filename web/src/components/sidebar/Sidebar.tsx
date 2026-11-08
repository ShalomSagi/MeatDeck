import { FileText, History as HistoryIcon, LayoutList, MessagesSquare, Plug, Settings2, Sunrise } from "lucide-react";
import type { DashboardState } from "../../../../shared/types.ts";
import type { BoardEntry } from "../../board.ts";
import type { Scope } from "../projects/scope.ts";
import type { SettingsPage } from "../settings/settingsSearch.tsx";
import { FooterButton } from "./FooterButton.tsx";
import { NavItem } from "./NavItem.tsx";
import { SidebarScopes } from "./SidebarScopes.tsx";
import { UpdateButton } from "./UpdateButton.tsx";
import { cn } from "../ui.tsx";
import { LimitMeter } from "../usage/LimitMeter.tsx";
import { fmtTokens } from "../../lib.ts";
import type { View } from "../../navigation.ts";

export function Sidebar({
  state,
  board,
  view,
  settingsPage,
  scope,
  noteId,
  connected,
  onView,
  onScope,
  onOpenNote,
  onNewNote,
  queueCount,
}: {
  queueCount: number;
  state: DashboardState;
  board: BoardEntry[];
  view: View;
  settingsPage: SettingsPage;
  scope: Scope;
  noteId: string | null;
  connected: boolean;
  onView: (v: View) => void;
  onScope: (s: Scope) => void;
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
}) {
  const openTodos = queueCount;
  const openNoteActions = state.notes.reduce((n, x) => n + x.openActions, 0);
  const fiveHour = state.usage.limits?.windows.find((w) => w.id === "five_hour");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      {/* 84px clears the macOS traffic lights; dropped in full screen, where they're hidden. */}
      <div className="drag-region flex h-[52px] items-center gap-2 px-4 in-[.traffic-lights]:pl-[84px]">
        <span className="text-sm font-semibold tracking-tight">MeatDeck</span>
        <span
          title={`MeatDeck v${__APP_VERSION__}: early, things may change or break`}
          className="rounded-full border border-border px-1.5 py-px text-[9.5px] leading-3 font-semibold tracking-[0.06em] text-muted-foreground uppercase"
        >
          Alpha
        </span>
        {/* Status only when something's wrong: a quiet app is a healthy app. */}
        {(!connected || state.github.error) && (
          <span
            className="size-1.5 rounded-full bg-warning"
            title={`${connected ? "Live" : "Reconnecting to the local server…"}${state.github.error ? ` · GitHub: ${state.github.error}` : ""}`}
          />
        )}
      </div>

      <nav className="flex flex-col gap-px px-2">
        <NavItem
          icon={<Sunrise />}
          label="Today"
          count={openTodos}
          active={view === "today"}
          onClick={() => onView("today")}
        />
        <NavItem
          icon={<LayoutList />}
          label="Work"
          count={board.length}
          active={view === "work" && !scope}
          onClick={() => onView("work")}
        />
        <NavItem
          icon={<FileText />}
          label="Docs"
          count={openNoteActions}
          active={view === "notes" && !noteId}
          onClick={() => onView("notes")}
        />
        <NavItem
          icon={<MessagesSquare />}
          label="Chats"
          count={state.chats.filter((c) => c.running).length}
          active={view === "chat"}
          onClick={() => onView("chat")}
        />
      </nav>

      <SidebarScopes
        state={state}
        board={board}
        scope={view === "work" ? scope : null}
        onScope={(next) => (next ? onScope(next) : onView("work"))}
        activeNoteId={view === "notes" ? noteId : null}
        onOpenNote={onOpenNote}
        onNewNote={onNewNote}
        onAllNotes={() => onView("notes")}
      />

      {/* One quiet footer row: usage at a glance + the rarely-used pages. */}
      <div className="flex items-center gap-0.5 border-t border-sidebar-border px-2 py-2">
        <button
          type="button"
          onClick={() => onView("usage")}
          title="Token usage"
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer flex-col gap-1 overflow-hidden rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-row-hover",
            view === "usage" && "bg-sidebar-row-active",
          )}
        >
          {fiveHour ? <LimitMeter w={fiveHour} compact /> : null}
          <span className="flex items-center gap-1.5 text-2xs text-sidebar-muted-foreground">
            <span className="size-2 rounded-[2px] bg-series-meatdeck" />
            <span className="tabular-nums text-sidebar-foreground/85">
              {fmtTokens(state.usage.windows.today.meatdeck.total)}
            </span>
            today
          </span>
        </button>
        <UpdateButton state={state} />
        <FooterButton label="History" active={view === "history"} onClick={() => onView("history")}>
          <HistoryIcon />
        </FooterButton>
        <FooterButton
          label="Integrations"
          active={view === "settings" && settingsPage === "integrations"}
          onClick={() => onView("integrations")}
        >
          <Plug />
        </FooterButton>
        <FooterButton
          label="Settings"
          active={view === "settings" && settingsPage !== "integrations"}
          onClick={() => onView("settings")}
        >
          <Settings2 />
        </FooterButton>
      </div>
    </aside>
  );
}

/** Set by Vite from package.json (shown on the Alpha badge). */
declare const __APP_VERSION__: string;
