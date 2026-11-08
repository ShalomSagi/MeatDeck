import {
  ArrowUpRight,
  GitMerge,
  LoaderCircle,
  Megaphone,
  MessageCircleReply,
  MessageSquarePlus,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import type { Action } from "../../../../shared/actions.ts";
import { api } from "../../api.ts";
import { CopyPromptButton } from "./CopyPromptButton.tsx";
import { StartInT3Button } from "./StartInT3Button.tsx";
import { Button } from "../ui.tsx";

export function PrimaryButton({
  a,
  expanded,
  onToggle,
  pending,
  sending,
}: {
  a: Action;
  expanded: boolean;
  onToggle: () => void;
  pending: boolean;
  sending: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (a.verb === "merge" && a.pr)
    return (
      <div className="flex items-center gap-1.5">
        {error && (
          <span className="max-w-48 truncate text-2xs text-destructive-foreground" title={error}>
            {error}
          </span>
        )}
        <Button
          size="xs"
          variant={confirm ? "default" : "outline"}
          disabled={busy}
          onBlur={() => setTimeout(() => setConfirm(false), 150)}
          onClick={async () => {
            if (!confirm) return setConfirm(true);
            setBusy(true);
            setError(null);
            try {
              await api.mergePr(a.pr!.url);
            } catch (e) {
              setError(((e as Error).message.match(/"error":"([^"]+)"/)?.[1] ?? "Merge failed").slice(0, 160));
            } finally {
              setBusy(false);
              setConfirm(false);
            }
          }}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <GitMerge />}
          {busy ? "Merging…" : confirm ? "Confirm merge" : "Merge"}
        </Button>
      </div>
    );
  if (a.agentPrompt)
    return (
      <div className="flex items-center gap-1">
        {error && (
          <span className="max-w-48 truncate text-2xs text-destructive-foreground" title={error}>
            {error}
          </span>
        )}
        {a.verb === "fix" && a.pr && (
          <Button
            size="xs"
            variant="ghost"
            disabled={busy}
            title="Re-run the failed GitHub Actions jobs (flaky test?)"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.rerunFailed(a.pr!.url);
                setError(null);
                setDone("Re-running");
              } catch (e) {
                setError(((e as Error).message.match(/"error":"([^"]+)"/)?.[1] ?? "Re-run failed").slice(0, 160));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
            {done ?? "Re-run"}
          </Button>
        )}
        {a.pr && <StartInT3Button a={a} onError={setError} />}
        <CopyPromptButton prompt={a.agentPrompt} compact={!!a.t3Link} />
        {a.url && (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            title={a.verb === "review" ? "Open the PR to review" : "Open PR"}
          >
            <Button size="icon-xs" variant="ghost-muted" tabIndex={-1} aria-label="Open PR">
              <ArrowUpRight />
            </Button>
          </a>
        )}
      </div>
    );
  if (a.verb === "send")
    return (
      <Button size="xs" variant={expanded ? "ghost" : "default"} disabled={sending} onClick={onToggle}>
        <MessageSquareText /> {expanded ? "Hide" : "Review & send"}
      </Button>
    );
  // Waiting rows: the recommended time is on the "Their move · nudge in 24h" chip, but you can always
  // move faster when something's unusually urgent.
  if (a.verb === "wait" && a.ball === "them")
    return (
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        title={`MeatDeck suggests nudging${a.nudgeIn ? ` in ${a.nudgeIn}` : " later"}. Draft one now if this can't wait.`}
        onClick={() => void api.assist(a.key)}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Megaphone />}
        {pending ? "Drafting…" : /^You (nudged|replied)/.test(a.why) ? "Nudge again now" : "Nudge now"}
      </Button>
    );
  if (a.verb === "ask")
    return (
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        title="Claude drafts the ask in your voice, with the link, for where you usually ask"
        onClick={() => void api.assist(a.key)}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <MessageSquarePlus />}
        {pending ? "Drafting…" : "Draft ask"}
      </Button>
    );
  if (a.verb === "nudge" || a.verb === "reply")
    return (
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => void api.assist(a.key, a.verb === "reply" ? "Draft a reply in my voice" : undefined)}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : a.verb === "reply" ? (
          <MessageCircleReply />
        ) : (
          <Megaphone />
        )}
        {pending ? "Drafting…" : a.verb === "reply" ? "Draft reply" : "Draft nudge"}
      </Button>
    );
  if (a.url && a.verb !== "wait")
    return (
      <a href={a.url} target="_blank" rel="noreferrer">
        <Button size="xs" variant="ghost" tabIndex={-1}>
          {a.verb === "review" ? "Review" : a.pr ? "Open PR" : "Open"} <ArrowUpRight />
        </Button>
      </a>
    );
  return null;
}
