// Settings, split into pages with a sub-nav (T3 Code style) and a search that finds any setting,
// plus live things: rules, models, hidden repos, integrations and always-allowed tools.
import { Search, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardState } from "../../../../shared/types.ts";
import { ActivitySettings } from "./ActivitySettings.tsx";
import { AllowedTools } from "./AllowedTools.tsx";
import { GeneralSettings } from "./GeneralSettings.tsx";
import { HiddenSettings } from "./HiddenSettings.tsx";
import { ProvidersSettings } from "./ProvidersSettings.tsx";
import { RulesSettings } from "./RulesSettings.tsx";
import { ScheduleSettings } from "./ScheduleSettings.tsx";
import { VoiceSettings } from "./VoiceSettings.tsx";
import { searchSettings } from "./SettingsView.logic.ts";
import { dynamicEntries, type Entry, PAGES, pageLabel, type SettingsPage, STATIC } from "./settingsSearch.tsx";
import { cn } from "../ui.tsx";
import { uniqueKeys } from "../../lib.ts";

export function SettingsView({
  state,
  page,
  onPage,
  onOpenLog,
  integrations,
}: {
  state: DashboardState;
  page: SettingsPage;
  onPage: (p: SettingsPage) => void;
  onOpenLog: (id: string) => void;
  /** The integrations page (needs the composer, so App renders it). */
  integrations: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // A new query starts at its first result.
  const search = (q: string) => {
    setQuery(q);
    setActive(0);
  };
  const [flash, setFlash] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // ⌘F / "/" focuses the search while Settings is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.metaKey && e.key === "f") || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(
    () => (query.trim() ? searchSettings([...STATIC, ...dynamicEntries(state)], query, pageLabel) : []),
    [query, state],
  );
  const resultKeys = uniqueKeys(results, (e) => `${e.page}-${e.anchor ?? ""}-${e.title}`);

  // After jumping to a result, scroll it into view and flash it.
  useEffect(() => {
    if (!flash) return;
    const t1 = setTimeout(
      () => document.getElementById(flash)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      30,
    );
    const t2 = setTimeout(() => setFlash(null), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [flash]);
  useEffect(() => {
    if (!flash) return;
    const el = document.getElementById(flash);
    el?.classList.add("setting-flash");
    return () => el?.classList.remove("setting-flash");
  }, [flash]);

  const open = (e: Entry) => {
    onPage(e.page);
    search("");
    if (e.anchor) setFlash(e.anchor);
    else document.querySelector("[data-settings-top]")?.scrollIntoView({ block: "start" });
  };

  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start" data-settings-top>
      <nav className="flex shrink-0 flex-col gap-2 md:sticky md:top-0 md:w-52">
        <label className="flex h-8 items-center gap-2 rounded-md border border-input bg-popover px-2.5 focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/32">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) open(results[active]);
              else if (e.key === "Escape") search("");
            }}
            placeholder="Search settings"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {query ? (
            <button
              type="button"
              onClick={() => search("")}
              aria-label="Clear search"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="text-2xs text-muted-foreground/60">⌘F</kbd>
          )}
        </label>
        <div className="flex gap-0.5 overflow-x-auto md:flex-col">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                search("");
                onPage(p.id);
              }}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm [&_svg]:size-4",
                p.id === page && !query
                  ? "bg-accent font-medium text-foreground [&_svg]:text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground [&_svg]:text-muted-foreground",
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {query.trim() ? (
          <div className="flex flex-col gap-1">
            <p className="px-1 pb-1 text-xs text-muted-foreground">
              {results.length
                ? `${results.length} result${results.length === 1 ? "" : "s"}`
                : `Nothing matches "${query.trim()}".`}
            </p>
            {results.map((e, i) => {
              const pg = PAGES.find((p) => p.id === e.page)!;
              return (
                <button
                  key={resultKeys[i]}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(e)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left [&_svg]:size-4",
                    i === active ? "border-border bg-accent" : "border-transparent hover:bg-accent/60",
                  )}
                >
                  <span className="text-muted-foreground">{e.icon ?? pg.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.title}</span>
                    {e.hint && <span className="block truncate text-xs text-muted-foreground">{e.hint}</span>}
                  </span>
                  <span className="shrink-0 text-2xs text-muted-foreground">{pg.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <header className="mb-4 px-1">
              <h2 className="text-base font-semibold">{current.label}</h2>
              <p className="text-xs text-muted-foreground">{current.hint}</p>
            </header>
            {page === "general" && <GeneralSettings state={state} />}
            {page === "schedule" && <ScheduleSettings state={state} />}
            {page === "providers" && <ProvidersSettings state={state} />}
            {page === "integrations" && integrations}
            {page === "voice" && <VoiceSettings state={state} />}
            {page === "rules" && (
              <div className="flex flex-col gap-6">
                <div id="setting-rules">
                  <RulesSettings state={state} />
                </div>
                <div id="setting-allowed">
                  <AllowedTools state={state} />
                  {!(state.settings.alwaysAllowTools ?? []).length && (
                    <p className="px-1 text-xs text-muted-foreground">
                      No always-allowed tools yet. When Claude asks for a tool, "Always allow" adds it here.
                    </p>
                  )}
                </div>
              </div>
            )}
            {page === "hidden" && <HiddenSettings state={state} />}
            {page === "activity" && <ActivitySettings state={state} onOpenLog={onOpenLog} />}
          </>
        )}
      </div>
    </div>
  );
}
