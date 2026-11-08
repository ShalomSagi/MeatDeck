import { ChevronRight, Eye } from "lucide-react";
import { useState } from "react";
import { cn } from "../ui.tsx";

export function HiddenList({ rows }: { rows: { key: string; label: string; kind: string; restore: () => unknown }[] }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-full cursor-pointer items-center gap-1.5 px-2.5 text-2xs text-sidebar-muted-foreground hover:text-sidebar-foreground"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        Hidden · {rows.length}
      </button>
      {open &&
        rows.map((r) => (
          <div
            key={r.key}
            className="flex h-7 items-center gap-2 rounded-md px-2.5 text-sm text-sidebar-muted-foreground/80"
          >
            <span className="flex-1 truncate line-through decoration-sidebar-muted-foreground/40">{r.label}</span>
            <span className="text-3xs uppercase">{r.kind}</span>
            <button
              type="button"
              title={`Show ${r.label} again`}
              aria-label={`Show ${r.label}`}
              onClick={() => void r.restore()}
              className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-accent hover:text-sidebar-foreground"
            >
              <Eye className="size-3.5" />
            </button>
          </div>
        ))}
    </div>
  );
}
