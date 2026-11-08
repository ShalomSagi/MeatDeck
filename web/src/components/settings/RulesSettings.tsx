/** Standing rules: every Claude run follows them; "ignore CI check" rules are enforced in code too. */
import { Brain } from "lucide-react";
import { useState } from "react";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { RuleRow } from "./RuleRow.tsx";
import { Button, Card, SectionHeader } from "../ui.tsx";

export function RulesSettings({ state }: { state: DashboardState }) {
  const [kind, setKind] = useState<"instruction" | "ignore_check">("instruction");
  const [text, setText] = useState("");
  const [pattern, setPattern] = useState("");
  const add = async () => {
    if (!text.trim() && !(kind === "ignore_check" && pattern.trim())) return;
    await api.addRule({
      kind,
      text: text.trim() || `Ignore CI checks matching "${pattern.trim()}"`,
      pattern: kind === "ignore_check" ? pattern.trim() : undefined,
    });
    setText("");
    setPattern("");
  };
  const BY: Record<string, string> = { you: "you", chat: "via chat", learned: "learned from a correction" };

  return (
    <section>
      <SectionHeader title="Rules" icon={<Brain />} count={state.rules.length} />
      <Card className="divide-y divide-border">
        <p className="px-4 py-3 text-xs leading-4.5 text-muted-foreground">
          Every Claude run follows these, whatever started it: the morning brief, pulses, chat, Change, discovery.{" "}
          <b className="font-medium text-foreground/80">Ignore a CI check</b> rules are also enforced in code, so
          failures of that check never become "Fix CI" items. You can also just tell the assistant, e.g. "never treat
          SonarQube as a CI failure".
        </p>
        {state.rules.map((r) => (
          <RuleRow key={r.id} rule={r} by={BY[r.by] ?? r.by} />
        ))}
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="h-8 rounded-md border border-input bg-popover px-2 text-xs dark:bg-input/32"
          >
            <option value="instruction">Instruction</option>
            <option value="ignore_check">Ignore a CI check</option>
          </select>
          {kind === "ignore_check" && (
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="check name, e.g. sonar"
              className="h-8 w-40 rounded-md border border-input bg-popover px-2 font-mono text-xs dark:bg-input/32"
            />
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "ignore_check"
                ? "Why (optional): SonarQube is allowed to fail"
                : "e.g. Never draft messages to #general"
            }
            className="h-8 min-w-60 flex-1 rounded-md border border-input bg-popover px-2.5 text-sm dark:bg-input/32"
          />
          <Button size="sm" type="submit">
            Add rule
          </Button>
        </form>
      </Card>
    </section>
  );
}
