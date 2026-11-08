import type { Entry, SettingsPage } from "./settingsSearch.tsx";

function score(e: Entry, words: string[], pageLabel: (page: SettingsPage) => string): number {
  const title = e.title.toLowerCase();
  const rest = `${e.hint ?? ""} ${e.keywords ?? ""} ${pageLabel(e.page)}`.toLowerCase();
  let total = 0;
  for (const w of words) {
    if (title.startsWith(w)) total += 4;
    else if (title.includes(w)) total += 3;
    else if (rest.includes(w)) total += 1;
    else return 0; // every word must match somewhere
  }
  return total;
}

/** The settings matching every word of the query, best match first (at most 30). */
export function searchSettings(entries: Entry[], query: string, pageLabel: (page: SettingsPage) => string): Entry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries
    .map((e) => ({ e, s: score(e, words, pageLabel) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 30)
    .map((x) => x.e);
}
