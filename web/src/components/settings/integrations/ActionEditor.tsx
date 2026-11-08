import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ActionImpl, ActionSpec, Integration } from "../../../../../shared/integrations.ts";
import { formatHeaders, parseHeaders, summary } from "./ActionEditor.logic.ts";
import { OutputPick } from "./OutputPick.tsx";
import { TestAction } from "./TestAction.tsx";
import { Badge, Button, cn } from "../../ui.tsx";

export function ActionEditor({
  i,
  spec,
  impl,
  onChange,
}: {
  i: Integration;
  spec: ActionSpec;
  impl: ActionImpl;
  onChange: (impl: ActionImpl) => void;
}) {
  const [open, setOpen] = useState(false);
  const supported = impl.kind !== "none";
  const blank = (): ActionImpl =>
    i.driver === "cli"
      ? { kind: "cli", command: "", output: "text" }
      : i.driver === "http"
        ? { kind: "http", method: "GET", url: "", output: "json" }
        : i.driver === "claude"
          ? { kind: "claude", tools: [], how: "" }
          : { kind: "builtin" };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label="Expand"
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium", !supported && "text-muted-foreground")}>{spec.label}</span>
            <Badge variant={spec.mode === "write" ? "warning" : "default"}>{spec.mode}</Badge>
            {!supported && <span className="text-2xs text-muted-foreground">not supported</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{summary(impl) ?? spec.description}</span>
        </button>
        <span className="hidden max-w-56 text-right text-2xs text-muted-foreground/70 md:block">{spec.usedBy}</span>
      </div>

      {open && (
        <div className="mt-3 ml-7 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {spec.description}
            {spec.inputs.length > 0 && (
              <>
                {" "}
                Inputs:{" "}
                {spec.inputs.map((x) => (
                  <code key={x.name} className="mx-0.5 rounded bg-accent px-1 font-mono">{`{{${x.name}}}`}</code>
                ))}
                .
              </>
            )}{" "}
            Returns: {spec.returns}.
          </p>
          {impl.kind === "builtin" && (
            <p className="text-xs text-foreground/80">Built into MeatDeck. Nothing to configure.</p>
          )}
          {impl.kind === "cli" && (
            <div className="flex flex-col gap-2">
              <input
                value={impl.command}
                onChange={(e) => onChange({ ...impl, command: e.target.value })}
                placeholder={`e.g. jira issue view {{id}} --plain`}
                className="h-8 rounded-md border border-input bg-background px-2.5 font-mono text-xs dark:bg-input/32"
              />
              <OutputPick value={impl.output} onChange={(output) => onChange({ ...impl, output })} />
            </div>
          )}
          {impl.kind === "http" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select
                  value={impl.method}
                  onChange={(e) => onChange({ ...impl, method: e.target.value as typeof impl.method })}
                  className="h-8 rounded-md border border-input bg-popover px-2 text-xs dark:bg-input/32"
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input
                  value={impl.url}
                  onChange={(e) => onChange({ ...impl, url: e.target.value })}
                  placeholder="https://api.example.com/items?q={{query}}"
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 font-mono text-xs dark:bg-input/32"
                />
              </div>
              <textarea
                value={formatHeaders(impl.headers)}
                onChange={(e) =>
                  onChange({
                    ...impl,
                    headers: parseHeaders(e.target.value),
                  })
                }
                rows={2}
                placeholder="Authorization: Bearer {{secret:API_TOKEN}}"
                className="resize-y rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs dark:bg-input/32"
              />
              {impl.method !== "GET" && (
                <textarea
                  value={impl.body ?? ""}
                  onChange={(e) => onChange({ ...impl, body: e.target.value })}
                  rows={3}
                  placeholder='{"text": "{{text}}"}'
                  className="resize-y rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs dark:bg-input/32"
                />
              )}
              <div className="flex items-center gap-2">
                <OutputPick value={impl.output} onChange={(output) => onChange({ ...impl, output })} />
                {impl.output === "json" && (
                  <input
                    value={impl.pick ?? ""}
                    onChange={(e) => onChange({ ...impl, pick: e.target.value || undefined })}
                    placeholder="pick: data.items"
                    className="h-7 w-40 rounded-md border border-input bg-background px-2 font-mono text-xs dark:bg-input/32"
                  />
                )}
              </div>
            </div>
          )}
          {impl.kind === "claude" && (
            <div className="flex flex-col gap-2">
              <input
                value={impl.how}
                onChange={(e) => onChange({ ...impl, how: e.target.value })}
                placeholder="How: which tool, and how (one line)"
                className="h-8 rounded-md border border-input bg-background px-2.5 text-sm dark:bg-input/32"
              />
              <input
                value={impl.tools.join(", ")}
                onChange={(e) =>
                  onChange({
                    ...impl,
                    tools: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Allowed tools, e.g. mcp__claude_ai_Slack__slack_send_message"
                className="h-8 rounded-md border border-input bg-background px-2.5 font-mono text-xs dark:bg-input/32"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {supported ? (
              <Button size="xs" variant="ghost-muted" onClick={() => onChange({ kind: "none" })}>
                <X /> Mark not supported
              </Button>
            ) : (
              <Button size="xs" variant="outline" onClick={() => onChange(blank())}>
                <Plus /> Implement
              </Button>
            )}
          </div>
          {supported && <TestAction i={i} spec={spec} />}
        </div>
      )}
    </div>
  );
}
