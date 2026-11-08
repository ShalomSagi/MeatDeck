/**
 * Claude noticed active work no project covers. Nothing exists until you accept: then it becomes a
 * project with the rules Claude proposed, so code groups its PRs, tickets and threads from then on.
 */
import { ArrowUpRight, Check, FolderPlus, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import type { Project, Suggestion } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { RefChip } from "../RefChip.tsx";
import { Button, Card } from "../ui.tsx";

export function Suggestions({
  suggestions,
  onOpenProject,
}: {
  suggestions: Suggestion[];
  onOpenProject: (p: Project) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Claude noticed</p>
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} s={s} onOpenProject={onOpenProject} />
      ))}
    </section>
  );
}

function SuggestionCard({ s, onOpenProject }: { s: Suggestion; onOpenProject: (p: Project) => void }) {
  const [name, setName] = useState(s.name);
  const [busy, setBusy] = useState<"accept" | "dismiss" | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const rules = Object.entries(s.rules ?? {}).flatMap(([, v]) => v ?? []);

  return (
    <Card className="group px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-primary/10 text-primary [&_svg]:size-3.5">
          <FolderPlus />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">New project?</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Project name"
              className="min-w-0 flex-1 rounded px-1 font-medium outline-none hover:bg-accent/60 focus:bg-accent/60"
            />
            <RefChip id={s.ref} className="opacity-0 group-hover:opacity-100" />
          </div>
          {s.why && <p className="mt-0.5 text-xs leading-4.5 text-muted-foreground">{s.why}</p>}
          {showEvidence && (
            <ul className="mt-2 flex flex-col gap-1">
              {s.evidence.map((e) => (
                <li key={e.text} className="flex gap-2 text-xs leading-4.5 text-foreground/80">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {e.text} <ArrowUpRight className="inline size-3 opacity-60" />
                    </a>
                  ) : (
                    e.text
                  )}
                </li>
              ))}
              {s.description && <li className="mt-1 text-xs text-muted-foreground">{s.description}</li>}
              {rules.length > 0 && (
                <li className="text-2xs text-muted-foreground/80">Will group work matching: {rules.join(", ")}</li>
              )}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            className="mt-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            {showEvidence ? "Hide evidence" : `${s.evidence.length} signals`}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="xs"
            variant="ghost-muted"
            disabled={!!busy}
            title="Not active work: Claude won't suggest it again"
            onClick={async () => {
              setBusy("dismiss");
              await api.dismissSuggestion(s.id).finally(() => setBusy(null));
            }}
          >
            {busy === "dismiss" ? <LoaderCircle className="animate-spin" /> : <X />} Not active
          </Button>
          <Button
            size="xs"
            disabled={!!busy || !name.trim()}
            onClick={async () => {
              setBusy("accept");
              try {
                onOpenProject(
                  await api.acceptSuggestion(s.id, name.trim() !== s.name ? { name: name.trim() } : undefined),
                );
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "accept" ? <LoaderCircle className="animate-spin" /> : <Check />} Create project
          </Button>
        </div>
      </div>
    </Card>
  );
}
