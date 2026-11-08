/** Try an action against the saved integration. Write actions ask first. */
import { LoaderCircle, Play } from "lucide-react";
import { useState } from "react";
import type { ActionSpec, Integration } from "../../../../../shared/integrations.ts";
import { api } from "../../../api.ts";
import { Button, cn } from "../../ui.tsx";

export function TestAction({ i, spec }: { i: Integration; spec: ActionSpec }) {
  const [input, setInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const claudeNote = i.actions[spec.id]?.kind === "claude" ? " (runs Claude: uses a few tokens)" : "";
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {spec.inputs.map((x) => (
          <input
            key={x.name}
            value={input[x.name] ?? ""}
            onChange={(e) => setInput((v) => ({ ...v, [x.name]: e.target.value }))}
            placeholder={x.example ?? x.description}
            title={x.description}
            className="h-7 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-xs dark:bg-input/32"
          />
        ))}
        <Button
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            if (spec.mode === "write" && !confirm(`This really performs "${spec.label}" on ${i.name}. Continue?`))
              return;
            setBusy(true);
            setResult(null);
            const r = await api
              .runIntegrationAction(i.id, spec.id, input, spec.mode === "write")
              .catch((e: Error) => ({ ok: false, error: e.message, output: undefined as unknown }));
            setResult({
              ok: !!r.ok,
              text: r.ok
                ? typeof r.output === "string"
                  ? r.output
                  : JSON.stringify(r.output, null, 2)
                : (r.error ?? "Failed"),
            });
            setBusy(false);
          }}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Play />} Test{claudeNote}
        </Button>
        <span className="text-2xs text-muted-foreground">Save first: tests run the saved version.</span>
      </div>
      {result && (
        <pre
          className={cn(
            "mt-2 max-h-64 overflow-auto rounded-md bg-background px-2.5 py-2 font-mono text-2xs leading-4 whitespace-pre-wrap",
            !result.ok && "text-destructive-foreground",
          )}
        >
          {result.text.slice(0, 6000) || "(empty)"}
        </pre>
      )}
    </div>
  );
}
