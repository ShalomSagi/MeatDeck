/** Agent CLIs on this Mac (T3 Code style): status, account, models. Probed by code, no tokens. */
import { Boxes, RefreshCw } from "lucide-react";
import { useState } from "react";
import { asSelection } from "../../../../shared/providers.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { ModelPicker } from "../chat/ModelPicker.tsx";
import { ProviderRow } from "./ProviderRow.tsx";
import { Button, Card, cn, SectionHeader } from "../ui.tsx";

export function ProvidersSettings({ state }: { state: DashboardState }) {
  const s = state.settings;
  const [busy, setBusy] = useState(false);
  const refreshAll = async () => {
    setBusy(true);
    try {
      await api.refreshProviders();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <SectionHeader
        title="Providers"
        icon={<Boxes />}
        action={
          <Button size="xs" variant="ghost-muted" onClick={() => void refreshAll()} disabled={busy}>
            <RefreshCw className={cn(busy && "animate-spin")} /> Check all
          </Button>
        }
      />
      <Card className="divide-y divide-border">
        {state.providers.map((p) => (
          <ProviderRow key={p.id} p={p} />
        ))}
        <div id="setting-chat-model" className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Default chat model</p>
            <p className="text-xs text-muted-foreground">
              New chats start here. The picker under the composer switches per chat.
            </p>
          </div>
          <ModelPicker
            providers={state.providers}
            value={asSelection(s.chatModel, s.chatProvider, s.chatEffort)}
            onChange={(sel) =>
              void api.updateSettings({
                chatModel: sel.model,
                chatProvider: sel.provider,
                chatEffort: sel.effort ?? "",
              })
            }
            align="right"
            placement="bottom"
          />
        </div>
      </Card>
      <p className="mt-2 px-1 text-2xs leading-4 text-muted-foreground">
        Chat runs on any ready provider with MeatDeck's tools. Scheduled runs and sends stay on Claude: they need
        Claude's skills and its Slack, Linear and Notion connectors.
      </p>
    </section>
  );
}
