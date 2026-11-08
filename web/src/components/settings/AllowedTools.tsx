/** Tools you answered "Always allow" for when Claude asked. Removing one makes Claude ask again. */
import { Power, Trash2 } from "lucide-react";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { Badge, Button, Card, SectionHeader } from "../ui.tsx";

export function AllowedTools({ state }: { state: DashboardState }) {
  const list = state.settings.alwaysAllowTools ?? [];
  if (!list.length) return null;
  const FILE_WRITES = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
  return (
    <section>
      <SectionHeader title="Always allowed tools" icon={<Power />} count={list.length} />
      <Card className="divide-y divide-border">
        <p className="px-4 py-3 text-xs leading-4.5 text-muted-foreground">
          Tools you answered "Always allow" for. They're added to every run you start. Remove one and Claude will ask
          again next time. File-writing tools never run, even if they're listed here: your content goes into MeatDeck.
        </p>
        {list.map((t) => (
          <div key={t} className="group flex items-center gap-3 px-4 py-2">
            <code className="flex-1 truncate font-mono text-xs">{t}</code>
            {FILE_WRITES.has(t) && <Badge variant="warning">blocked: writes files</Badge>}
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label={`Stop allowing ${t}`}
              title="Remove"
              className="opacity-0 group-hover:opacity-100"
              onClick={() => void api.updateSettings({ alwaysAllowTools: list.filter((x) => x !== t) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </Card>
    </section>
  );
}
