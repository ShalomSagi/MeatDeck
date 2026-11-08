import { Check, ChevronRight, ListTodo, MessageSquareText, Send } from "lucide-react";
import type { ChatArtifact, NoteMeta } from "../../../../shared/types.ts";
import { DocIcon } from "../docs/DocIcon.tsx";
import { cn } from "../ui.tsx";

export function ArtifactCard({
  a,
  docs,
  onOpenNote,
  onGoToday,
}: {
  a: ChatArtifact;
  docs?: NoteMeta[];
  onOpenNote: (id: string) => void;
  onGoToday: () => void;
}) {
  const base =
    "flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm transition-colors [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground";
  switch (a.kind) {
    case "note":
      return (
        <button
          type="button"
          onClick={() => onOpenNote(a.id)}
          className={cn(base, "cursor-pointer hover:bg-accent/60")}
        >
          <DocIcon icon={docs?.find((n) => n.id === a.id)?.icon} />
          <span className="min-w-0 flex-1">
            <span className="block text-2xs text-muted-foreground">{a.created ? "Created doc" : "Updated doc"}</span>
            <span className="block truncate font-medium">{a.title}</span>
          </span>
          <ChevronRight />
        </button>
      );
    case "todos":
      return (
        <button type="button" onClick={onGoToday} className={cn(base, "cursor-pointer hover:bg-accent/60")}>
          <ListTodo />
          <span className="min-w-0 flex-1">
            <span className="block text-2xs text-muted-foreground">
              Added {a.ids.length} todo{a.ids.length === 1 ? "" : "s"} to Today
            </span>
            <span className="block truncate">{a.titles.join(" · ")}</span>
          </span>
          <ChevronRight />
        </button>
      );
    case "drafts":
      return (
        <button type="button" onClick={onGoToday} className={cn(base, "cursor-pointer hover:bg-accent/60")}>
          <MessageSquareText />
          <span className="min-w-0 flex-1">
            <span className="block text-2xs text-muted-foreground">Drafted for your review</span>
            <span className="block truncate">To {a.to.join(", ")}</span>
          </span>
          <ChevronRight />
        </button>
      );
    case "sent":
      return (
        <div className={base}>
          <Send />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-2xs text-success-foreground">
              <Check className="size-3" /> Sent on {a.channel}
            </span>
            <span dir="auto" className="block truncate text-foreground/85">
              {a.text}
            </span>
          </span>
        </div>
      );
    case "link":
      return (
        <a href={a.url} target="_blank" rel="noreferrer" className={cn(base, "hover:bg-accent/60")}>
          <ChevronRight />
          <span className="truncate">{a.title}</span>
        </a>
      );
  }
}
