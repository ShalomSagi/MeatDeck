// Model picker, T3 Code style: models grouped by provider (only providers that are enabled and
// installed), filterable, with the model's reasoning levels as a second step. Lists come from the
// server's provider probes (Settings → Providers), so new models show up without an app update.

/** Used before the first probe lands, so the picker is never empty. */
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  EFFORT_LABEL,
  modelLabel,
  type ModelSelection,
  PROVIDER_LABEL,
  type ProviderStatus,
} from "../../../../shared/providers.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";
import { cn } from "../ui.tsx";

const FALLBACK: ProviderStatus = {
  id: "claude",
  label: PROVIDER_LABEL.claude,
  enabled: true,
  installed: true,
  status: "ready",
  auth: { status: "unknown" },
  models: [
    { slug: "haiku", name: "Haiku", description: "Fast, cheap: lookups, docs, todos" },
    { slug: "sonnet", name: "Sonnet", description: "Better writing and reasoning" },
    { slug: "opus", name: "Opus", description: "Hardest asks" },
  ],
};

export function usableProviders(providers: ProviderStatus[] | undefined): ProviderStatus[] {
  const list = (providers ?? []).filter((p) => p.enabled && p.installed && p.models.length && p.status !== "error");
  return list.some((p) => p.id === "claude") ? list : [FALLBACK, ...list];
}

export function ModelPicker({
  providers,
  value,
  onChange,
  onOpenChange,
  align = "left",
  placement = "top",
}: {
  providers: ProviderStatus[] | undefined;
  value: ModelSelection;
  onChange: (s: ModelSelection) => void;
  onOpenChange?: (open: boolean) => void;
  align?: "left" | "right";
  placement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = usableProviders(providers);
  const [tab, setTab] = useState(value.provider);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const notifyOpen = useEffectEvent((o: boolean) => onOpenChange?.(o));
  useEffect(() => notifyOpen(open), [open]);
  useEffect(() => {
    if (!open) return;
    setTimeout(() => search.current?.focus(), 0);
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const provider = list.find((p) => p.id === tab) ?? list[0];
  const q = query.trim().toLowerCase();
  const models = q ? provider.models.filter((m) => `${m.name} ${m.slug}`.toLowerCase().includes(q)) : provider.models;
  const current = list.find((p) => p.id === value.provider)?.models.find((m) => m.slug === value.model);
  const efforts = current?.efforts ?? [];

  // Each open starts on the current provider's tab with an empty search.
  const toggle = () => {
    if (!open) {
      setTab(list.some((p) => p.id === value.provider) ? value.provider : list[0].id);
      setQuery("");
    }
    setOpen(!open);
  };

  const pick = (s: ModelSelection) => {
    onChange(s);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative flex items-center gap-0.5">
      <button
        type="button"
        onClick={toggle}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        title={`${PROVIDER_LABEL[value.provider]} · ${value.model}`}
      >
        <ProviderIcon provider={value.provider} />
        {modelLabel(value, list)}
        <ChevronDown className="size-3.5" />
      </button>
      {efforts.length > 0 && (
        <select
          value={value.effort ?? ""}
          onChange={(e) => onChange({ ...value, effort: e.target.value || undefined })}
          title="Reasoning"
          className="h-7 cursor-pointer appearance-none rounded-md bg-transparent px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
        >
          <option value="">
            {current?.defaultEffort
              ? `${EFFORT_LABEL[current.defaultEffort] ?? current.defaultEffort} (default)`
              : "Default effort"}
          </option>
          {efforts.map((e) => (
            <option key={e} value={e}>
              {EFFORT_LABEL[e] ?? e}
            </option>
          ))}
        </select>
      )}
      {open && (
        <div
          className={cn(
            "absolute z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/5",
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          {list.length > 1 && (
            <div className="flex gap-1 border-b border-border p-1">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTab(p.id)}
                  className={cn(
                    "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                    p.id === provider.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  <ProviderIcon provider={p.id} />
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {provider.models.length > 8 && (
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && models[0]) pick({ provider: provider.id, model: models[0].slug });
                }}
                placeholder={`Search ${provider.label} models`}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1">
            {models.map((m) => {
              const selected = value.provider === provider.id && value.model === m.slug;
              return (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() =>
                    pick({
                      provider: provider.id,
                      model: m.slug,
                      ...(selected && value.effort ? { effort: value.effort } : {}),
                    })
                  }
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-accent",
                    selected && "bg-accent",
                  )}
                >
                  <ProviderIcon provider={provider.id} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{m.name}</span>
                      {m.isDefault && <span className="text-2xs font-normal text-muted-foreground">default</span>}
                    </span>
                    {(m.description || m.slug !== m.name) && (
                      <span className="block truncate text-2xs text-muted-foreground">{m.description ?? m.slug}</span>
                    )}
                  </span>
                  {selected && <Check className="mt-1 size-3.5 shrink-0" />}
                </button>
              );
            })}
            {!models.length && <p className="px-2.5 py-2 text-xs text-muted-foreground">No models match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
