// Integrations: which services MeatDeck talks to, and how each one performs its category's actions.
import { ChevronRight, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, categoryOf } from "../../../../../shared/integrations.ts";
import type { DashboardState } from "../../../../../shared/types.ts";
import { api } from "../../../api.ts";
import { IntegrationDetail } from "./IntegrationDetail.tsx";
import { IntegrationIcon } from "./IntegrationIcon.tsx";
import { NewIntegrationDialog } from "./NewIntegrationDialog.tsx";
import { DRIVER, type IntegrationRow, tone } from "./drivers.tsx";
import { Badge, Button, Card, SectionHeader, StatusDot, Switch } from "../../ui.tsx";

export function IntegrationsView({ state, onAsk }: { state: DashboardState; onAsk: (prompt: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const rows = state.integrations as IntegrationRow[];
  const open = rows.find((r) => r.id === openId);
  if (open) return <IntegrationDetail i={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            MeatDeck's features call <span className="text-foreground">actions</span> by category, like "send a
            message", "list my issues" or "merge a PR". An integration decides how one service performs them: MeatDeck's
            own code, a CLI, an API, or Claude with a connector you already have.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost-muted"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await api.refreshIntegrationStatus().catch(() => {});
            setRefreshing(false);
          }}
        >
          {refreshing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Check status
        </Button>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> New integration
        </Button>
      </div>

      {CATEGORIES.map((cat) => {
        const list = rows.filter((r) => r.category === cat.id);
        return (
          <section key={cat.id}>
            <SectionHeader
              title={cat.label}
              count={list.length}
              action={
                <span className="hidden text-2xs text-muted-foreground/70 sm:inline">{cat.actions.length} actions</span>
              }
            />
            <Card className="divide-y divide-border overflow-hidden">
              {list.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                >
                  <Plus className="size-4" /> Connect a {cat.label.toLowerCase()} service
                </button>
              )}
              {list.map((r) => (
                <div
                  key={r.id}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    <IntegrationIcon i={r} className="size-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      <Badge variant="outline" className="[&_svg]:size-3">
                        {DRIVER[r.driver].icon} {DRIVER[r.driver].label}
                      </Badge>
                      {!r.predefined && <Badge>Custom</Badge>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusDot tone={tone(r.status)} />
                      {r.status.text}
                      <span className="text-muted-foreground/50">·</span>
                      {Object.values(r.actions).filter((a) => a.kind !== "none").length}/
                      {categoryOf(r.category).actions.length} actions
                    </span>
                  </button>
                  <Switch
                    checked={r.enabled}
                    onChange={(enabled) => void api.saveIntegration({ ...r, enabled })}
                    label={`${r.name} on`}
                  />
                  <ChevronRight className="size-4 text-muted-foreground/50" />
                </div>
              ))}
            </Card>
          </section>
        );
      })}

      {creating && (
        <NewIntegrationDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
          onAsk={(p) => {
            setCreating(false);
            onAsk(p);
          }}
        />
      )}
    </div>
  );
}
