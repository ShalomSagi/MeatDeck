// The settings index: the pages, and every setting by name so the search can find it.
import { Activity, AudioLines, Boxes, Brain, CalendarClock, EyeOff, Plug, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { PROVIDER_LABEL } from "../../../../shared/providers.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";

export type SettingsPage =
  | "general"
  | "schedule"
  | "providers"
  | "integrations"
  | "voice"
  | "rules"
  | "hidden"
  | "activity";

export const PAGES: { id: SettingsPage; label: string; icon: ReactNode; hint: string }[] = [
  {
    id: "general",
    label: "General",
    icon: <SlidersHorizontal />,
    hint: "Models for runs, idle skipping, open at login",
  },
  { id: "schedule", label: "Schedule", icon: <CalendarClock />, hint: "Morning brief, pulse checks, wrap-up" },
  { id: "providers", label: "Providers", icon: <Boxes />, hint: "Claude Code, Codex, Cursor and their models" },
  { id: "integrations", label: "Integrations", icon: <Plug />, hint: "How MeatDeck reaches GitHub, Linear, Slack…" },
  { id: "voice", label: "Your voice", icon: <AudioLines />, hint: "How drafted messages should sound" },
  { id: "rules", label: "Rules & permissions", icon: <Brain />, hint: "Standing rules and always-allowed tools" },
  { id: "hidden", label: "Hidden", icon: <EyeOff />, hint: "Repos and projects MeatDeck ignores" },
  { id: "activity", label: "Activity", icon: <Activity />, hint: "Runs and what code noticed" },
];

export interface Entry {
  page: SettingsPage;
  /** DOM id to scroll to and flash; missing = top of the page. */
  anchor?: string;
  title: string;
  hint?: string;
  keywords?: string;
  icon?: ReactNode;
}

/** Every setting by name, with words people might search for. */
export const STATIC: Entry[] = [
  {
    page: "general",
    anchor: "setting-model",
    title: "Model",
    hint: "Morning brief, wrap-up and sending",
    keywords: "claude default opus sonnet run model",
  },
  {
    page: "general",
    anchor: "setting-small-model",
    title: "Small model",
    hint: "Pulse checks and Change requests",
    keywords: "haiku cheap pulse model",
  },
  {
    page: "general",
    anchor: "setting-idle",
    title: "Skip while away",
    hint: "Skip pulses when the Mac is idle",
    keywords: "idle away afk locked tokens",
  },
  {
    page: "general",
    anchor: "setting-updates",
    title: "Updates",
    hint: "Rebuild and restart into the latest version",
    keywords: "update upgrade version ota restart rebuild latest",
  },
  {
    page: "general",
    anchor: "setting-login",
    title: "Open at login",
    hint: "Start in the background",
    keywords: "startup launch login item boot",
  },
  {
    page: "schedule",
    anchor: "setting-morning",
    title: "Morning brief",
    hint: "Full /today run on work days",
    keywords: "today brief time days schedule",
  },
  {
    page: "schedule",
    anchor: "setting-pulse",
    title: "Pulse checks",
    hint: "Cheap pass for what changed",
    keywords: "interval every minutes hours from to",
  },
  {
    page: "schedule",
    anchor: "setting-wrapup",
    title: "Wrap-up",
    hint: "End-of-day run",
    keywords: "evening end of day carry over",
  },
  {
    page: "providers",
    title: "Providers",
    hint: "Which agent CLIs MeatDeck can use",
    keywords: "claude code codex openai cursor cli status login version",
  },
  {
    page: "providers",
    anchor: "setting-chat-model",
    title: "Default chat model",
    hint: "What new chats start on",
    keywords: "composer chat model provider reasoning effort",
  },
  {
    page: "integrations",
    title: "Integrations",
    hint: "GitHub, Linear, Slack, Notion, calendar, CI",
    keywords: "connect service connector jira cli http secret keychain",
  },
  {
    page: "voice",
    title: "Your voice",
    hint: "Learned from your messages",
    keywords: "tone style writing drafts learn",
  },
  {
    page: "rules",
    anchor: "setting-rules",
    title: "Rules",
    hint: "What every run follows",
    keywords: "instruction ignore ci check always never",
  },
  {
    page: "rules",
    anchor: "setting-allowed",
    title: "Always allowed tools",
    hint: "Tools you allowed once for good",
    keywords: "permission allow tool approve",
  },
  {
    page: "hidden",
    title: "Hidden repos & projects",
    hint: "Out of the UI and never sent to Claude",
    keywords: "ignore hide repo project mute",
  },
  {
    page: "activity",
    anchor: "setting-runs",
    title: "Runs",
    hint: "Recent Claude runs and their logs",
    keywords: "log history tokens run",
  },
  {
    page: "activity",
    anchor: "setting-noticed",
    title: "Noticed by code",
    hint: "GitHub changes tracked without Claude",
    keywords: "events changes github",
  },
];

export function dynamicEntries(state: DashboardState): Entry[] {
  const out: Entry[] = [];
  for (const r of state.rules)
    out.push({
      page: "rules",
      anchor: `rule-${r.id}`,
      title: r.text,
      hint: r.kind === "ignore_check" ? `Ignore CI check ${r.pattern ?? ""}` : "Rule",
      icon: <Brain />,
    });
  for (const p of state.providers) {
    out.push({
      page: "providers",
      anchor: `provider-${p.id}`,
      title: p.label,
      hint: p.auth.label ?? p.status,
      icon: <ProviderIcon provider={p.id} />,
    });
    for (const m of p.models)
      out.push({
        page: "providers",
        anchor: `provider-${p.id}`,
        title: m.name,
        hint: `${PROVIDER_LABEL[p.id]} model · ${m.slug}`,
        keywords: m.slug,
        icon: <ProviderIcon provider={p.id} />,
      });
  }
  for (const i of state.integrations)
    out.push({ page: "integrations", title: i.name, hint: `Integration · ${i.category}`, icon: <Plug /> });
  for (const r of state.settings.ignoredRepos)
    out.push({ page: "hidden", title: r, hint: "Hidden repo", icon: <EyeOff /> });
  for (const p of state.projects.filter((x) => x.ignored))
    out.push({ page: "hidden", title: p.name, hint: "Hidden project", icon: <EyeOff /> });
  for (const t of state.settings.alwaysAllowTools ?? [])
    out.push({ page: "rules", anchor: "setting-allowed", title: t, hint: "Always allowed tool", icon: <Brain /> });
  return out;
}

/** The page's name, which search also matches on. */
export const pageLabel = (page: SettingsPage) => PAGES.find((p) => p.id === page)?.label ?? "";
