// Settings: defaults (work days follow the Mac's region), migrations of older stored settings, and patches.
import type { Settings } from "../../shared/types.ts";
import { localeWorkDays } from "../locale.ts";
import type { Store } from "./store.ts";

// Work days follow the Mac's region (Mon–Fri in most places, Sun–Thu where the weekend is Fri–Sat).
// Only a default: once settings are stored, the stored days win (see settings()).
const DEFAULT_SETTINGS: Settings = {
  morning: { enabled: true, time: "08:30", days: localeWorkDays() },
  pulse: { enabled: true, everyMinutes: 90, from: "09:30", to: "18:30" },
  wrapup: { enabled: false, time: "18:30" },
  model: "",
  pulseModel: "haiku",
  chatModel: "haiku",
  skipWhenIdleMinutes: 20,
  ignoredRepos: [],
};

export function settings(store: Store): Settings {
  const s = (store.data.settings ?? {}) as Partial<Settings> & { ignoredProjects?: string[] };
  // Migration: the old single ignore list held repo names; repos and projects are separate now.
  if (s.ignoredProjects && !s.ignoredRepos) s.ignoredRepos = s.ignoredProjects;
  delete s.ignoredProjects;
  // Settings stored before work days followed the locale had Sun–Thu as the default; keep it.
  const legacyDays = store.data.settings && !s.morning?.days ? { days: [0, 1, 2, 3, 4] } : {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    morning: { ...DEFAULT_SETTINGS.morning, ...legacyDays, ...(s as Settings).morning },
    pulse: { ...DEFAULT_SETTINGS.pulse, ...(s as Settings).pulse },
    wrapup: { ...DEFAULT_SETTINGS.wrapup, ...(s as Settings).wrapup },
  };
}

export function updateSettings(s: Store, patch: Partial<Settings>): Settings {
  const cur = s.settings();
  s.data.settings = {
    ...cur,
    ...patch,
    morning: { ...cur.morning, ...patch.morning },
    pulse: { ...cur.pulse, ...patch.pulse },
    wrapup: { ...cur.wrapup, ...patch.wrapup },
  };
  s.save();
  return s.data.settings;
}
