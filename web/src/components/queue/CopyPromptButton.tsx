/** Copies a ready-to-paste prompt for T3 Code / Claude Code: for work only a coding agent can do. */
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui.tsx";

export function CopyPromptButton({ prompt, compact }: { prompt: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={compact ? "icon-xs" : "xs"}
      variant={compact ? "ghost-muted" : "outline"}
      aria-label="Copy prompt"
      title={compact ? `Copy prompt (for Claude Code or another agent):\n\n${prompt}` : prompt}
      onClick={async () => {
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {!compact && (copied ? "Copied" : "Copy prompt")}
    </Button>
  );
}
