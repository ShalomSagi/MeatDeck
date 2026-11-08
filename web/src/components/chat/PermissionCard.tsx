// Claude wants a tool it wasn't pre-allowed: the run waits here for your call.

/** "Always allow" covers the whole server for MCP tools, or the command for Bash. */
import { ChevronRight, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import type { PermissionRequest } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { Button, cn } from "../ui.tsx";

function alwaysLabel(tool: string, input: unknown): string {
  if (tool.startsWith("mcp__")) {
    const server = tool
      .slice(0, tool.lastIndexOf("__"))
      .replace(/^mcp__claude_ai_/, "")
      .replace(/^mcp__/, "")
      .replace(/_/g, " ");
    return `Always allow ${server}`;
  }
  const command = (input as { command?: unknown } | null)?.command;
  if (tool === "Bash" && typeof command === "string") return `Always allow \`${command.trim().split(/\s+/)[0]}\``;
  return `Always allow ${tool}`;
}

export function PermissionCard({ req, compact }: { req: PermissionRequest; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const act = async (d: "allow" | "always" | "deny") => {
    setBusy(true);
    await api.decidePermission(req.id, d);
  };
  return (
    // Solid surface (not a translucent tint) so it never blends with the page behind it.
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-warning/50 bg-popover px-3 py-2.5 shadow-xl before:pointer-events-none before:absolute before:inset-0 before:bg-warning/8 dark:before:bg-warning/12",
        compact && "py-2 shadow-none",
      )}
    >
      <div className="relative flex items-start gap-2">
        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Claude wants to use a tool it doesn't have permission for</p>
          <p className="mt-0.5 truncate font-mono text-xs text-foreground/80" title={req.summary}>
            {req.summary}
          </p>
          {req.run && !compact && <p className="mt-0.5 truncate text-2xs text-muted-foreground">{req.run}</p>}
          <button
            type="button"
            onClick={() => setDetails((v) => !v)}
            className="mt-1 flex cursor-pointer items-center gap-0.5 text-2xs text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn("size-3 transition-transform", details && "rotate-90")} /> Details
          </button>
          {details && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-background/60 px-2 py-1.5 font-mono text-2xs leading-4 whitespace-pre-wrap">
              {req.tool}
              {"\n"}
              {JSON.stringify(req.input, null, 2).slice(0, 2000)}
            </pre>
          )}
        </div>
      </div>
      <div className="relative mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        <Button size="xs" variant="default" disabled={busy} onClick={() => void act("allow")}>
          Allow once
        </Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={() => void act("always")}>
          {alwaysLabel(req.tool, req.input)}
        </Button>
        <Button size="xs" variant="ghost-muted" disabled={busy} onClick={() => void act("deny")}>
          Deny
        </Button>
      </div>
    </div>
  );
}
