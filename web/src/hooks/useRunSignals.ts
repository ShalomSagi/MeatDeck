/** Desktop notification + dock badge when an unattended run finishes, and reminders for due actions. */
import { useEffect, useRef } from "react";
import type { DashboardState } from "../../../shared/types.ts";
import { desktop } from "../desktop.ts";

export function useRunSignals(state: DashboardState | null, onOpenNote: (id: string) => void) {
  const lastSeen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default")
      void Notification.requestPermission();
  }, []);
  useEffect(() => {
    const run = state?.run;
    if (!run || run.status === "running" || run.status === "queued") return;
    if (lastSeen.current === undefined) {
      lastSeen.current = run.id; // don't notify for a run that finished before we opened
      return;
    }
    if (lastSeen.current === run.id) return;
    lastSeen.current = run.id;
    if (run.kind === "send" && run.status === "done") return;
    notify(run.status === "failed" ? `${run.label} failed` : run.label, run.summary ?? "", {
      silent: run.kind === "pulse",
    });
  }, [state?.run]);

  // A run is waiting for your OK: say so even if the window is hidden.
  const askedRef = useRef(new Set<string>());
  useEffect(() => {
    for (const p of state?.permissions ?? []) {
      if (askedRef.current.has(p.id)) continue;
      askedRef.current.add(p.id);
      notify("Claude is waiting for your permission", p.summary);
    }
  }, [state?.permissions]);

  // Due-today reminders for action items (plain code: once per item per day).
  useEffect(() => {
    if (!state) return;
    for (const t of state.day.todos) {
      if (t.status !== "open" || !t.due || t.due > state.today) continue;
      const key = `meatdeck:reminded:${t.id}:${state.today}`;
      try {
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
      } catch {
        continue;
      }
      notify(t.due < state.today ? "Overdue" : "Due today", t.title, {
        onClick: t.noteId ? () => onOpenNote(t.noteId!) : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.day.todos, state?.today]);

  const badge = state
    ? state.day.todos.filter((t) => t.status === "open" && t.priority === "p0").length +
      state.day.messages.filter((m) => m.status === "draft" || m.status === "approved").length
    : 0;
  useEffect(() => {
    void desktop?.setBadge(badge);
  }, [badge]);
}

function notify(title: string, body: string, opts: { silent?: boolean; onClick?: () => void } = {}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const n = new Notification(title, { body, silent: opts.silent });
  n.onclick = () => {
    void desktop?.showWindow();
    opts.onClick?.();
  };
}
