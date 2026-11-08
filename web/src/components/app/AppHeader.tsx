/** The bar above every page: its title, the next or running run, and the global buttons. */
import { CalendarClock, LoaderCircle, MessagesSquare, RefreshCw, TerminalSquare } from "lucide-react";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { clock, KIND_META } from "../runs/runKinds.tsx";
import type { SettingsPage } from "../settings/settingsSearch.tsx";
import { Button, cn } from "../ui.tsx";
import { agoText, formatDay } from "../../lib.ts";
import type { View } from "../../navigation.ts";

export function AppHeader({
  state,
  title,
  view,
  onGo,
  onOpenRun,
  onToggleRun,
}: {
  state: DashboardState;
  title: string;
  view: View;
  onGo: (v: View, page?: SettingsPage) => void;
  /** Opens the live run's log. */
  onOpenRun: () => void;
  onToggleRun: () => void;
}) {
  const run = state.run;
  const running = run?.status === "running" && run.kind !== "send";
  const next = state.nextRuns.find((n) => n.at !== "queued");
  const startRun = async () => {
    onOpenRun();
    await api.runClaude("manual");
  };
  return (
    <header className="drag-region flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-5">
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <span className="shrink-0 text-xs text-muted-foreground">{formatDay(state.today)}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {running ? (
          <button
            type="button"
            onClick={onOpenRun}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LoaderCircle className="size-3.5 animate-spin text-primary" /> {run?.label}…
          </button>
        ) : (
          next && (
            <button
              type="button"
              onClick={() => onGo("settings", "schedule")}
              title="Schedule settings"
              className="hidden cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground lg:flex"
            >
              <CalendarClock className="size-3.5" /> {KIND_META[next.kind].label} {clock(next.at)}
            </button>
          )
        )}
        <Button
          variant="ghost-muted"
          size="icon-sm"
          aria-label="Refresh GitHub"
          title={`GitHub synced ${agoText(state.github.fetchedAt)}`}
          onClick={() => api.refreshGithub()}
        >
          <RefreshCw />
        </Button>
        <ThemeToggle />
        <Button
          variant="ghost-muted"
          size="icon-sm"
          aria-label="Chat"
          title="Chats"
          className={cn(view === "chat" && "bg-accent text-foreground")}
          onClick={() => onGo("chat")}
        >
          <MessagesSquare />
        </Button>
        <Button variant="ghost-muted" size="icon-sm" aria-label="Claude run log" onClick={onToggleRun}>
          <TerminalSquare />
        </Button>
        <Button size="sm" onClick={startRun} disabled={running}>
          {running && <LoaderCircle className="animate-spin" />}
          {state.day.brief ? "Refresh" : "Plan my day"}
        </Button>
      </div>
    </header>
  );
}
