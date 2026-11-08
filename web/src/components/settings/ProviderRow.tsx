import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ProviderStatus } from "../../../../shared/providers.ts";
import { api } from "../../api.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";
import { cn, StatusDot, Switch } from "../ui.tsx";
import { agoText } from "../../lib.ts";

export function ProviderRow({ p }: { p: ProviderStatus }) {
  const [open, setOpen] = useState(false);
  const tone =
    p.status === "ready" ? "success" : p.status === "warning" ? "warning" : p.status === "error" ? "error" : "muted";
  return (
    <div id={`provider-${p.id}`} className="px-4 py-3">
      <div className="flex items-center gap-3">
        <StatusDot tone={p.checking ? "info" : tone} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ProviderIcon provider={p.id} />
            {p.label}
            {p.version && <span className="font-mono text-2xs font-normal text-muted-foreground">v{p.version}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {p.checking
              ? "Checking…"
              : !p.enabled
                ? "Off"
                : [
                    p.auth.status === "authenticated"
                      ? p.auth.label || "Signed in"
                      : p.auth.status === "unauthenticated"
                        ? "Not signed in"
                        : null,
                    p.models.length ? `${p.models.length} models` : null,
                    p.message,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Not checked yet"}
            {p.checkedAt && !p.checking && (
              <span className="text-muted-foreground/60"> · checked {agoText(p.checkedAt)}</span>
            )}
          </p>
        </div>
        {p.models.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="cursor-pointer text-2xs text-muted-foreground hover:text-foreground"
          >
            {open ? "Hide models" : "Models"}
          </button>
        )}
        <button
          type="button"
          title="Check again"
          onClick={() => void api.refreshProviders(p.id)}
          disabled={p.checking || !p.enabled}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={cn("size-3.5", p.checking && "animate-spin")} />
        </button>
        {p.id === "claude" ? (
          <span className="w-8 text-right text-2xs text-muted-foreground/60" title="Scheduled runs need Claude">
            req.
          </span>
        ) : (
          <Switch checked={p.enabled} onChange={(v) => void api.setProviderEnabled(p.id, v)} label={`Use ${p.label}`} />
        )}
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1 pl-4.5">
          {p.models.map((m) => (
            <span
              key={m.slug}
              title={m.description ?? m.slug}
              className="rounded-md border border-border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
            >
              {m.slug}
              {m.isDefault && " ★"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
