import { Bot, Plug, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type ActionImpl,
  CATEGORIES,
  type CategoryId,
  categoryOf,
  type Driver,
} from "../../../../../shared/integrations.ts";
import { api } from "../../../api.ts";
import { DRIVER } from "./drivers.tsx";
import { Button, cn } from "../../ui.tsx";

export function NewIntegrationDialog({
  onClose,
  onCreated,
  onAsk,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  onAsk: (prompt: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryId>("issues");
  const [driver, setDriver] = useState<Driver>("cli");
  const [mcpServer, setMcpServer] = useState("");
  const [servers, setServers] = useState<{ name: string; state: string }[]>([]);
  useEffect(() => {
    if (driver === "claude" && !servers.length)
      void api
        .mcpServers()
        .then(setServers)
        .catch(() => {});
  }, [driver, servers.length]);
  const create = async () => {
    if (!name.trim()) return;
    const cat = categoryOf(category);
    const blank = (): ActionImpl =>
      driver === "cli"
        ? { kind: "cli", command: "", output: "text" }
        : driver === "http"
          ? { kind: "http", method: "GET", url: "", output: "json" }
          : { kind: "claude", tools: [], how: "" };
    const i = await api.createIntegration({
      name: name.trim(),
      category,
      driver,
      enabled: true,
      mcpServer: driver === "claude" ? mcpServer : undefined,
      secrets: driver === "http" ? [] : undefined,
      actions: Object.fromEntries(cat.actions.map((a) => [a.id, blank()])),
    });
    onCreated(i.id);
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-popover p-4 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <Plug className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">New integration</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service name, e.g. Jira"
          className="mt-3 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20 dark:bg-input/32"
        />
        <p className="mt-3 mb-1.5 text-2xs font-medium text-muted-foreground uppercase">Category</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-xs",
                category === c.id ? "border-primary bg-primary/8" : "border-border hover:bg-accent",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-3 mb-1.5 text-2xs font-medium text-muted-foreground uppercase">How MeatDeck talks to it</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["cli", "http", "claude"] as Driver[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDriver(d)}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left [&_svg]:size-3.5",
                driver === d ? "border-primary bg-primary/8" : "border-border hover:bg-accent",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {DRIVER[d].icon} {DRIVER[d].label}
              </span>
              <span className="text-2xs leading-4 text-muted-foreground">{DRIVER[d].hint}</span>
            </button>
          ))}
        </div>
        {driver === "claude" && (
          <select
            value={mcpServer}
            onChange={(e) => setMcpServer(e.target.value)}
            className="mt-3 h-8 w-full rounded-md border border-input bg-popover px-2 text-xs dark:bg-input/32"
          >
            <option value="">Pick the Claude connector…</option>
            {servers.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} {s.state !== "connected" ? `(${s.state})` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!name.trim()}
            onClick={() =>
              onAsk(
                `Set up a ${CATEGORIES.find((c) => c.id === category)!.label.toLowerCase()} integration for ${name.trim()} using ${driver === "cli" ? "its CLI" : driver === "http" ? "its HTTP API" : `the ${mcpServer || "Claude"} connector`}. Read list_integrations for the actions, figure out how ${name.trim()} does each one, save_integration, then test the read actions with run_integration_action and tell me what works.`,
              )
            }
          >
            <Bot /> Ask Claude to set it up
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost-muted" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || (driver === "claude" && !mcpServer)}
              onClick={() => void create()}
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
