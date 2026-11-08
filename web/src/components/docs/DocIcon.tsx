// Doc icons, Notion style: each doc can have one emoji as its icon. Shown wherever a doc is listed;
// docs without one fall back to their kind's icon.
import { FileText, Users } from "lucide-react";
import type { Note } from "../../../../shared/types.ts";
import { cn } from "../ui.tsx";

export function DocIcon({ icon, kind, className }: { icon?: string; kind?: Note["kind"]; className?: string }) {
  if (icon)
    return (
      <span
        aria-hidden
        className={cn("inline-flex size-4 shrink-0 items-center justify-center text-[0.9em] leading-none", className)}
      >
        {icon}
      </span>
    );
  const Icon = kind === "meeting" ? Users : FileText;
  return <Icon className={cn("size-4 shrink-0", className)} />;
}
