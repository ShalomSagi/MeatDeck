import {
  AlarmClock,
  AlertTriangle,
  Check,
  CircleDot,
  Eye,
  GitMerge,
  GitPullRequestArrow,
  Hourglass,
  Megaphone,
  MessageCircleReply,
  MessageSquarePlus,
  MessageSquareText,
  MessagesSquare,
  Wrench,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Action, Verb } from "../../../../shared/actions.ts";
import { priorityRank, projectPriority, repoShort } from "../../../../shared/projects.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { RefChip } from "../RefChip.tsx";
import { DocIcon } from "../docs/DocIcon.tsx";
import { SourceIcon } from "../icons.tsx";
import { PriorityIcon } from "../projects/PriorityIcon.tsx";
import { ChangePanel } from "./ChangePanel.tsx";
import { DueChip } from "./DueChip.tsx";
import { MessageCard } from "./MessageCard.tsx";
import { PrChip } from "./PrChip.tsx";
import { PrimaryButton } from "./PrimaryButton.tsx";
import { revisionOf } from "./revision.ts";
import { Badge, Button, cn } from "../ui.tsx";

const VERB_ICON: Record<Verb, ReactNode> = {
  merge: <GitMerge />,
  send: <MessageSquareText />,
  address: <MessageCircleReply />,
  fix: <Wrench />,
  rebase: <AlertTriangle />,
  review: <Eye />,
  reply: <MessageCircleReply />,
  nudge: <Megaphone />,
  wait: <Hourglass />,
  do: <CircleDot />,
  decide: <GitPullRequestArrow />,
  ask: <MessageSquarePlus />,
};

export function ActionRow({
  a,
  state,
  onOpenNote,
  hideProject,
}: {
  a: Action;
  state: DashboardState;
  onOpenNote: (id: string) => void;
  hideProject?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [changing, setChanging] = useState(false);
  const revision = revisionOf(state, `action:${a.key}`);
  const message = a.messageId ? state.day.messages.find((m) => m.id === a.messageId) : undefined;
  const msgRevision = message ? revisionOf(state, `message:${message.id}`) : undefined;
  // Highest-priority project first, so the priority glyph sits next to the project it comes from.
  const projects = a.projectIds
    .map((id) => state.projects.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((x, y) => priorityRank(projectPriority(x).level) - priorityRank(projectPriority(y).level))
    .map((p) => p.name);
  const note = a.noteId ? state.notes.find((n) => n.id === a.noteId) : undefined;
  const checkable = !!a.todoId && !a.pr; // plain todos: tick to finish
  // The id you'd paste into a Claude session: the todo, else the draft, else the tracked item.
  const rowRef =
    (a.todoId && state.day.todos.find((t) => t.id === a.todoId)?.ref) ||
    message?.ref ||
    (a.itemId && state.items.find((i) => i.id === a.itemId)?.ref) ||
    undefined;
  const sending = state.run?.status === "running" && state.run.kind === "send";

  return (
    <div
      className={cn(
        "group px-3 py-2.5 transition-colors",
        !expanded && "hover:bg-accent/50",
        a.ball === "them" && a.verb === "wait" && "opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        {checkable ? (
          <button
            type="button"
            aria-label="Mark done"
            onClick={() => void api.updateTodo(a.todoId!, { status: "done" })}
            className="mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-input transition-colors hover:border-primary dark:bg-input/32"
          />
        ) : (
          // The step's icon; on hover it turns into a checkbox, so any row can be ticked off.
          <button
            type="button"
            aria-label="Mark done"
            title="Mark done"
            onClick={() => void api.markActionDone(a.key)}
            className="group/check relative mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center"
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-[5px] group-hover:hidden [&_svg]:size-3.5",
                a.verb === "merge"
                  ? "bg-success/12 text-success-foreground"
                  : a.ball === "them"
                    ? "bg-info/10 text-info-foreground"
                    : "bg-accent text-muted-foreground",
              )}
            >
              {VERB_ICON[a.verb]}
            </span>
            <span className="hidden size-5 items-center justify-center rounded-[5px] border border-input transition-colors group-hover:flex group-hover/check:border-primary dark:bg-input/32">
              <Check className="size-3 text-primary opacity-0 group-hover/check:opacity-60" strokeWidth={3} />
            </span>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() =>
              message ? setExpanded((v) => !v) : a.url ? window.open(a.url, "_blank") : setExpanded((v) => !v)
            }
            className="block w-full cursor-pointer text-left text-sm leading-5 font-medium hover:underline hover:decoration-muted-foreground/40 hover:underline-offset-2"
          >
            {a.title}
          </button>
          {a.why && (
            <p
              dir="auto"
              className={cn("mt-0.5 text-xs leading-4.5 text-muted-foreground", !expanded && "line-clamp-1")}
            >
              {a.by === "claude" && <span className="mr-1 font-medium text-foreground/70">Claude:</span>}
              {a.why}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
            {a.ball === "them" && (
              <Badge variant="info">
                <Hourglass /> {a.verb === "wait" ? `Their move · nudge in ${a.nudgeIn}` : "Their move"}
              </Badge>
            )}
            {a.pr && <PrChip pr={a.pr} />}
            <RefChip id={rowRef} className="opacity-0 group-hover:opacity-100" />
            {a.due && <DueChip due={a.due} today={state.today} />}
            {!hideProject &&
              projects.map((p, i) => (
                <span key={p} className="inline-flex items-center gap-1 text-foreground/70">
                  {i === 0 && a.priority ? <PriorityIcon level={a.priority} className="size-3" /> : null}
                  {p}
                </span>
              ))}
            {a.repo && !hideProject && !a.pr && <span className="font-mono">{repoShort(a.repo)}</span>}
            <span className="inline-flex items-center gap-1">
              <SourceIcon source={a.source === "note" ? "manual" : a.source} className="size-3" />
            </span>
            {note && (
              <button
                type="button"
                onClick={() => onOpenNote(note.id)}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground hover:underline"
              >
                <DocIcon icon={note.icon} kind={note.kind} className="size-3" /> {note.title || "Untitled doc"}
              </button>
            )}
            {a.by === "claude" && (
              <button
                type="button"
                title="Use the default ranking instead of Claude's"
                onClick={() => void api.clearPriority(a.key)}
                className="inline-flex cursor-pointer items-center gap-0.5 rounded px-1 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground"
              >
                <X className="size-3" /> Claude's rank
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              size="icon-xs"
              variant="ghost-muted"
              title="Chat about this: ask Claude anything about it (close the PR, message someone, change it…)"
              aria-label="Chat about this"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("meatdeck:chat-about", { detail: { type: "action", key: a.key, title: a.title } }),
                )
              }
            >
              <MessagesSquare />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost-muted"
              title="Not now: still to do, back tomorrow"
              aria-label="Not now"
              onClick={() => void api.snooze(a.key)}
            >
              <AlarmClock />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost-muted"
              title={
                a.pr
                  ? "Dismiss: don't do this step, don't remind me (a new step on this PR still shows)"
                  : "Dismiss: don't do this, don't remind me"
              }
              aria-label="Dismiss"
              onClick={() => void api.dismissAction(a.key)}
            >
              <X />
            </Button>
          </div>
          <PrimaryButton
            a={a}
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            pending={revision.pending}
            sending={sending}
          />
        </div>
      </div>

      {(changing || revision.pending || revision.last) && (
        <div className="mt-2 pl-8">
          <ChangePanel
            kind="action"
            id={a.key}
            revision={revision}
            open={changing}
            onClose={() => setChanging(false)}
            placeholder="e.g. this blocks Tuesday's release · not urgent, Dana is out · draft a reply saying I'll do it Thursday"
            submitWith={(instruction) => api.assist(a.key, instruction)}
          />
        </div>
      )}

      {expanded && message && msgRevision && (
        <div className="mt-2.5 pl-8">
          <MessageCard message={message} sending={sending && message.status === "approved"} revision={msgRevision} />
        </div>
      )}
    </div>
  );
}
