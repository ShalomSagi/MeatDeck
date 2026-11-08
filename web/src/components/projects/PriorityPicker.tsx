import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRIORITY_LABEL, projectPriority } from "../../../../shared/projects.ts";
import type { Project } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { LinearIcon } from "../icons.tsx";
import { PriorityIcon } from "./PriorityIcon.tsx";
import { cn } from "../ui.tsx";

const ORDER = [1, 2, 3, 4, 0];

/** Priority picker for a project: yours overrides Linear's; "Follow Linear" clears the override. */
export function PriorityPicker({ project: p, compact }: { project: Project; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { level, from } = projectPriority(p);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const set = (priority: number | null) => {
    setOpen(false);
    void api.updateProject(p.id, { priority });
  };
  const linearLevel = p.linearPriority ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={
          from === "linear"
            ? "Priority from Linear. Click to override it in MeatDeck."
            : from === "you"
              ? "Your MeatDeck priority"
              : "Set a priority: Claude and the ranking use it"
        }
        className={cn(
          "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-input px-2 text-xs text-foreground/85 transition-colors hover:bg-accent",
          level === 1 && "text-[#d9822b] dark:text-[#f2994a]",
        )}
      >
        <PriorityIcon level={level} />
        {!compact && <span>{level ? PRIORITY_LABEL[level] : "Priority"}</span>}
        {from === "linear" && <LinearIcon className="size-3 text-[#5E6AD2]" />}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-popover p-1 text-sm shadow-lg/10">
          {p.kind === "linear" && (
            <>
              <button
                type="button"
                onClick={() => set(null)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              >
                <LinearIcon className="size-3.5 text-[#5E6AD2]" />
                <span className="flex-1">
                  Follow Linear
                  <span className="ml-1 text-muted-foreground">
                    {p.linearPriority === undefined ? "(not synced yet)" : `(${PRIORITY_LABEL[linearLevel]})`}
                  </span>
                </span>
                {from !== "you" && <Check className="size-3.5" />}
              </button>
              <div className="my-1 h-px bg-border" />
            </>
          )}
          {ORDER.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => set(l)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <PriorityIcon level={l} className="text-muted-foreground" />
              <span className="flex-1">{PRIORITY_LABEL[l]}</span>
              {(p.kind === "linear" ? from === "you" && level === l : level === l) && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
