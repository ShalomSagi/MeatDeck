// The update button, like T3 Code's: a small round ↑ in the sidebar footer, shown only when a newer
// build is ready (the source folder changed since this build). Click → rebuild and restart into it.
import { CircleArrowUp, LoaderCircle, TriangleAlert } from "lucide-react";
import type { DashboardState, UpdateStatus } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { cn } from "../ui.tsx";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function updateSummary(u: UpdateStatus): string {
  if (u.channel === "release")
    return `Version ${u.latest} is out (you have ${u.version}).${u.notes ? `\n\n${u.notes.slice(0, 600)}` : ""}`;
  const files = u.changed.slice(0, 6).join("\n") + (u.changed.length > 6 ? `\n…and ${u.changed.length - 6} more` : "");
  return `${plural(u.changed.length, "file")} changed since this build:\n${files}`;
}

/** Restarting cuts off whatever's running, so say so first. */
export function confirmUpdate(state: DashboardState): boolean {
  const busy = [
    state.run?.status === "running" ? `the "${state.run.label}" run` : "",
    state.chats.some((c) => c.running) ? "a chat reply" : "",
  ].filter(Boolean);
  return !busy.length || confirm(`Updating restarts MeatDeck, which stops ${busy.join(" and ")}. Update now?`);
}

export function UpdateButton({ state }: { state: DashboardState }) {
  const u = state.update;
  if (!u || !["available", "updating", "failed"].includes(u.state)) return null;
  const updating = u.state === "updating";
  const failed = u.state === "failed";
  const title = updating
    ? `${u.progress ?? "Updating…"} MeatDeck restarts when it's ready.`
    : failed
      ? `Update failed. Click to try again.\n\n${u.message ?? ""}`
      : `Update available: click to ${u.channel === "release" ? "install it" : "rebuild"} and restart.\n\n${updateSummary(u)}`;
  return (
    <button
      type="button"
      title={title}
      aria-label={updating ? "Updating" : failed ? "Update failed, retry" : "Update MeatDeck"}
      disabled={updating}
      onClick={() => confirmUpdate(state) && void api.applyUpdate()}
      className={cn(
        "relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-default [&_svg]:size-4",
        failed ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-sidebar-row-hover",
      )}
    >
      {updating ? <LoaderCircle className="animate-spin" /> : failed ? <TriangleAlert /> : <CircleArrowUp />}
    </button>
  );
}
