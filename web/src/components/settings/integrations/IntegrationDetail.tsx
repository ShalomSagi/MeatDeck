import { ArrowLeft, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { type ActionImpl, categoryOf, type Integration } from "../../../../../shared/integrations.ts";
import { api } from "../../../api.ts";
import { ActionEditor } from "./ActionEditor.tsx";
import { IntegrationIcon } from "./IntegrationIcon.tsx";
import { Secrets } from "./Secrets.tsx";
import { DRIVER, type IntegrationRow, tone } from "./drivers.tsx";
import { Button, Card, SectionHeader, StatusDot, Switch } from "../../ui.tsx";

export function IntegrationDetail({ i, onBack }: { i: IntegrationRow; onBack: () => void }) {
  const cat = categoryOf(i.category);
  const [draft, setDraft] = useState<Integration>(i);
  const [saving, setSaving] = useState(false);
  // Fresh server state resets the form.
  const [synced, setSynced] = useState(i);
  if (i !== synced) {
    setSynced(i);
    setDraft(i);
  }
  const dirty = JSON.stringify(stripStatus(draft)) !== JSON.stringify(stripStatus(i));
  const setAction = (id: string, impl: ActionImpl) =>
    setDraft((d) => ({ ...d, actions: { ...d.actions, [id]: impl } }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button size="xs" variant="ghost-muted" onClick={onBack}>
          <ArrowLeft /> Integrations
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted">
          <IntegrationIcon i={i} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">{i.name}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {cat.label} · {DRIVER[i.driver].label} · <StatusDot tone={tone(i.status)} /> {i.status.text}
          </p>
        </div>
        <Switch checked={draft.enabled} onChange={(enabled) => setDraft((d) => ({ ...d, enabled }))} label="Enabled" />
        {!i.predefined && (
          <Button
            size="icon-sm"
            variant="ghost-muted"
            title="Delete integration"
            aria-label="Delete integration"
            onClick={async () => {
              if (!confirm(`Delete the ${i.name} integration?`)) return;
              await api.deleteIntegration(i.id);
              onBack();
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <p className="-mt-3 max-w-2xl text-sm text-muted-foreground">
        {i.description ?? cat.description} {DRIVER[i.driver].hint}
      </p>

      {i.driver === "claude" && (
        <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-xs text-muted-foreground">Claude connector</span>
          <input
            value={draft.mcpServer ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, mcpServer: e.target.value }))}
            placeholder='Name as in `claude mcp list`, e.g. "claude.ai Slack"'
            className="h-7 min-w-64 flex-1 rounded-md border border-input bg-popover px-2 font-mono text-xs dark:bg-input/32"
          />
        </Card>
      )}
      {i.driver === "http" && <Secrets i={draft} onChange={(secrets) => setDraft((d) => ({ ...d, secrets }))} />}

      <section>
        <SectionHeader
          title="Actions"
          count={cat.actions.length}
          action={
            <span className="text-2xs text-muted-foreground/70">
              What {cat.label.toLowerCase()} integrations do for MeatDeck
            </span>
          }
        />
        <Card className="divide-y divide-border">
          {cat.actions.map((spec) => (
            <ActionEditor
              key={spec.id}
              i={draft}
              spec={spec}
              impl={draft.actions[spec.id] ?? { kind: "none" }}
              onChange={(impl) => setAction(spec.id, impl)}
            />
          ))}
        </Card>
      </section>

      {dirty && (
        <div className="sticky bottom-28 z-20 flex items-center gap-2 self-end rounded-xl border border-border bg-popover px-3 py-2 shadow-xl">
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
          <Button size="xs" variant="ghost-muted" onClick={() => setDraft(i)}>
            Discard
          </Button>
          <Button
            size="xs"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await api.saveIntegration(stripStatus(draft));
              setSaving(false);
            }}
          >
            {saving && <LoaderCircle className="animate-spin" />} Save
          </Button>
        </div>
      )}
    </div>
  );
}

const stripStatus = (i: Integration & { status?: unknown }): Integration => {
  const { status: _s, ...rest } = i;
  return rest;
};
