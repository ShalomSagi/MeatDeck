// "Change…": tell Claude what you actually want for one card (a draft, a todo). A small, targeted
// run applies it, and may learn a general rule from it so next time it gets it right on its own.
import { CornerDownLeft, LoaderCircle, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api.ts";
import type { Revision } from "./revision.ts";
import { cn } from "../ui.tsx";
import { agoText } from "../../lib.ts";

export function ChangePanel({
  kind,
  id,
  revision,
  open,
  onClose,
  placeholder,
  submitWith,
}: {
  kind: "message" | "todo" | "action";
  id: string;
  /** Override how the instruction is sent (queue actions use /api/actions/assist). */
  submitWith?: (instruction: string) => Promise<unknown>;
  revision: Revision;
  open: boolean;
  onClose: () => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [sentText, setSentText] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  // The run finished: drop the echo of what you sent.
  const [wasPending, setWasPending] = useState(revision.pending);
  if (revision.pending !== wasPending) {
    setWasPending(revision.pending);
    if (!revision.pending) setSentText(undefined);
  }

  const submit = async () => {
    const instruction = text.trim();
    if (!instruction) return;
    setText("");
    setSentText(instruction);
    onClose();
    if (submitWith) await submitWith(instruction);
    else if (kind !== "action") await api.revise(kind, id, instruction);
  };

  if (revision.pending)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-xs text-foreground/85 dark:bg-primary/16">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" />
        <span className="truncate">
          Claude is changing this{revision.instruction || sentText ? `: “${revision.instruction ?? sentText}”` : "…"}
        </span>
      </div>
    );

  return (
    <>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-center gap-2 rounded-lg border border-ring/40 bg-background px-2.5 ring-2 ring-ring/15 dark:bg-input/32"
        >
          <Wand2 className="size-3.5 shrink-0 text-primary" />
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            placeholder={placeholder}
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {text.trim() ? (
            <CornerDownLeft className="size-3.5 text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>
      )}
      {!open && revision.last && (
        <p
          className={cn(
            "flex items-start gap-1.5 text-2xs leading-4",
            revision.last.failed ? "text-destructive-foreground" : "text-muted-foreground",
          )}
        >
          <Wand2 className="mt-px size-3 shrink-0" />
          <span>
            {revision.last.failed ? "Change failed" : "Changed"} {agoText(revision.last.at)}
            {revision.last.summary ? `: ${revision.last.summary}` : ""}
          </span>
        </p>
      )}
    </>
  );
}
