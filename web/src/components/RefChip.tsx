// A readable id ("N-12") you can copy and paste into any Claude session: the meatdeck MCP's
// `lookup` tool resolves it, so "read N-12" works in T3 Code too.
import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "./ui.tsx";

export function RefChip({ id, className }: { id?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;
  return (
    <button
      type="button"
      title={`Copy ${id}. Any Claude session can read it ("read ${id}") through the meatdeck MCP.`}
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1100);
      }}
      className={cn(
        "inline-flex h-[18px] shrink-0 cursor-pointer items-center gap-0.5 rounded-[4px] border border-border bg-muted px-1 font-mono text-[10.5px] leading-none text-muted-foreground transition-colors hover:border-input hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="size-2.5" /> copied
        </>
      ) : (
        id
      )}
    </button>
  );
}
