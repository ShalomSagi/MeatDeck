/** "core#25505": the handle you say out loud ("merge 25505"); copies the PR link on click. */
import { useState } from "react";
import type { Action } from "../../../../shared/actions.ts";
import { repoShort } from "../../../../shared/projects.ts";

export function PrChip({ pr }: { pr: NonNullable<Action["pr"]> }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`${pr.title}\nClick to copy the link`}
      onClick={async () => {
        await navigator.clipboard.writeText(pr.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex cursor-pointer items-center rounded border border-border/70 px-1 font-mono text-[10.5px] leading-4 text-foreground/75 hover:bg-accent hover:text-foreground"
    >
      {copied ? "Copied link" : `${repoShort(pr.repo)}#${pr.number}`}
    </button>
  );
}
