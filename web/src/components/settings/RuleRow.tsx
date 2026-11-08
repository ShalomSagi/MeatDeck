import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Rule } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { RefChip } from "../RefChip.tsx";
import { Badge, Button, cn, Switch } from "../ui.tsx";

export function RuleRow({ rule: r, by }: { rule: Rule; by: string }) {
  const [text, setText] = useState(r.text);
  const [pattern, setPattern] = useState(r.pattern ?? "");
  // Server changes to the rule replace local edits, field by field.
  const [saved, setSaved] = useState({ text: r.text, pattern: r.pattern });
  if (r.text !== saved.text || r.pattern !== saved.pattern) {
    setSaved({ text: r.text, pattern: r.pattern });
    if (r.text !== saved.text) setText(r.text);
    if (r.pattern !== saved.pattern) setPattern(r.pattern ?? "");
  }
  return (
    <div id={`rule-${r.id}`} className={cn("group flex items-start gap-3 px-4 py-2.5", !r.enabled && "opacity-55")}>
      <Switch checked={r.enabled} onChange={(enabled) => void api.updateRule(r.id, { enabled })} label="Rule on" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={r.kind === "ignore_check" ? "warning" : "default"}>
            {r.kind === "ignore_check" ? "Ignore CI check" : "Instruction"}
          </Badge>
          {r.kind === "ignore_check" && (
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              onBlur={() =>
                pattern.trim() && pattern !== r.pattern && void api.updateRule(r.id, { pattern: pattern.trim() })
              }
              className="h-6 w-32 rounded border border-transparent bg-transparent px-1 font-mono text-xs hover:border-input focus:border-input focus:outline-none"
              title="Check-name pattern (case-insensitive, * wildcard)"
            />
          )}
          <span className="text-2xs text-muted-foreground">{by}</span>
          <RefChip id={r.ref} />
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text !== r.text && void api.updateRule(r.id, { text: text.trim() })}
          className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-input focus:border-input focus:outline-none"
        />
        {r.from && <p className="mt-0.5 truncate px-1 text-2xs text-muted-foreground">from: “{r.from}”</p>}
      </div>
      <Button
        size="icon-xs"
        variant="ghost-muted"
        aria-label="Delete rule"
        title="Delete rule"
        className="opacity-0 group-hover:opacity-100"
        onClick={() => void api.deleteRule(r.id)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
