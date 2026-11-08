// What the UI and Claude see: the full state snapshot (GET /api/state and the event stream), the
// action queue built server-side, and integration statuses.
import { buildActions } from "../shared/actions.ts";
import { matchProjects } from "../shared/projects.ts";
import type { DashboardState, Note, NoteMeta } from "../shared/types.ts";
import { changes } from "./changes.ts";
import { chatList } from "./chat/chatStore.ts";
import { currentRun, queued } from "./claude/runQueue.ts";
import { github } from "./github.ts";
import { cachedStatus, statusOf } from "./integrations.ts";
import { pendingPermissions } from "./permissions.ts";
import { providerStatuses } from "./providers/registry.ts";
import { nextRuns } from "./scheduler.ts";
import { store } from "./store/store.ts";
import { updateStatus } from "./updates.ts";
import { usageSummary } from "./usage.ts";

export function snapshot(): DashboardState {
  const day = store.today();
  return {
    today: day.date,
    day,
    items: store.items(),
    github,
    run: currentRun,
    runs: store.runs(),
    settings: store.settings(),
    events: store.events().slice(0, 50),
    usage: usageSummary(),
    providers: providerStatuses(),
    update: updateStatus(),
    projects: store.projects(),
    notes: store.notes().map(noteMeta),
    projectLinks: store.links(),
    nextRuns: [...queued().map((q) => ({ kind: q.kind, at: "queued", target: q.target })), ...nextRuns()],
    preferences: store.preferences(),
    voice: store.voiceState(),
    chats: chatList(),
    priorities: store.priorities(),
    rules: store.rules(),
    suggestions: store.suggestions().filter((x) => x.status === "pending"),
    sent: store.sentLog(),
    permissions: pendingPermissions(),
    integrations: withStatus(),
    snoozes: store.snoozes(),
    dismissed: store.dismissals(),
    reviewAsks: store.reviewAsks(),
    reviewAskChecked: store.reviewAskChecked(),
    reviewAskLog: store.reviewAskLog(),
    history: store.history(),
  };
}

function noteMeta(n: Note): NoteMeta {
  const tasks = store.today().todos.filter((t) => t.noteId === n.id);
  return {
    id: n.id,
    ref: n.ref,
    title: n.title,
    kind: n.kind,
    icon: n.icon,
    pinned: n.pinned,
    updatedAt: n.updatedAt,
    createdAt: n.createdAt,
    openActions: tasks.filter((t) => t.status === "open").length,
    doneActions: tasks.filter((t) => t.status === "done").length,
    projectIds: matchProjects({ key: `note:${n.id}`, title: n.title, text: n.text }, store.projects(), store.links()),
    preview: n.text.replace(/\s+/g, " ").slice(0, 140),
  };
}

// ---- the action queue ----
/** The same queue the UI shows, built server-side (for Claude and for acting on a key). */
export function currentActions() {
  return buildActions({
    state: {
      sent: store.sentLog(),
      today: store.today().date,
      day: store.today(),
      items: store.items(),
      github,
      projects: store.projects(),
      projectLinks: store.links(),
      settings: store.settings(),
      priorities: store.priorities(),
      snoozes: store.snoozes(),
      dismissed: store.dismissals(),
      reviewAsks: store.reviewAsks(),
      reviewAskLog: store.reviewAskLog(),
    },
  });
}

export const withStatus = () => store.integrations().map((i) => ({ ...i, status: cachedStatus(i) }));
export const refreshStatuses = async (force = false) => {
  // Show each result as it lands (the Claude connector check is slow; the rest are instant).
  for (const i of store.integrations()) {
    await statusOf(i, force);
    changes.emit("change");
  }
};
