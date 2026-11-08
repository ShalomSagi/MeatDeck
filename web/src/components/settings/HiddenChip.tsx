import { X } from "lucide-react";
import { cn } from "../ui.tsx";

export function HiddenChip({ label, mono, onRemove }: { label: string; mono?: boolean; onRemove: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted pr-1 pl-2 text-xs",
        mono && "font-mono",
      )}
    >
      {label}
      <button
        type="button"
        aria-label={`Show ${label} again`}
        title="Show again"
        onClick={onRemove}
        className="flex size-4 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
