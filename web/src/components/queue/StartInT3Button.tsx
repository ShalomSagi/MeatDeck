/**
 * Starts a NEW T3 Code thread that begins working right away (t3 CLI: own PRs get a fresh worktree on
 * the PR's branch). If the CLI path fails, falls back to T3's prompt link, which fills the composer.
 */
import { Check, LoaderCircle, SquareTerminal } from "lucide-react";
import { useState } from "react";
import type { Action } from "../../../../shared/actions.ts";
import { api } from "../../api.ts";
import { Button } from "../ui.tsx";

export function StartInT3Button({ a, onError }: { a: Action; onError: (e: string | null) => void }) {
  const [state, setState] = useState<"idle" | "starting" | "started">("idle");
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={state === "starting"}
      title={`Start a new T3 Code thread that works on this now${["fix", "address", "rebase", "review"].includes(a.verb) ? " (in a fresh worktree on the PR's branch)" : ""}:\n\n${a.agentPrompt}`}
      onClick={async () => {
        setState("starting");
        onError(null);
        try {
          await api.startInT3({
            url: a.pr!.url,
            repo: a.pr!.repo,
            number: a.pr!.number,
            verb: a.verb,
            title: a.title,
            prompt: a.agentPrompt!,
          });
          setState("started");
          setTimeout(() => setState("idle"), 4000);
        } catch (e) {
          setState("idle");
          const msg = ((e as Error).message.match(/"error":"([^"]+)"/)?.[1] ?? "Couldn't start T3").slice(0, 160);
          if (a.t3Link) {
            onError(`${msg}. Opened T3's prompt link instead.`);
            window.open(a.t3Link, "_blank");
          } else onError(msg);
        }
      }}
    >
      {state === "starting" ? (
        <LoaderCircle className="animate-spin" />
      ) : state === "started" ? (
        <Check />
      ) : (
        <SquareTerminal />
      )}
      {state === "starting" ? "Starting…" : state === "started" ? "Started in T3" : "Start in T3"}
    </Button>
  );
}
