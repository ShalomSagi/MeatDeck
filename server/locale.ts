// The Mac's region, for defaults that differ by country: which days are work days, and whether
// "11/12" means 11 December or November 12. The backend runs without LANG set, so Intl alone
// would say en-US; macOS keeps the region the user picked in AppleLocale (e.g. "en_GB").
import { execFileSync } from "node:child_process";

let cached: string | undefined;

function macLocale(): string {
  if (cached) return cached;
  const candidates = [process.env.LC_ALL, process.env.LANG];
  if (process.platform === "darwin") {
    try {
      candidates.unshift(
        execFileSync("/usr/bin/defaults", ["read", "-g", "AppleLocale"], { encoding: "utf8", timeout: 2000 }).trim(),
      );
    } catch {
      // not set: fall through
    }
  }
  for (const raw of candidates) {
    // "en_GB.UTF-8" → "en-GB", "de_DE@calendar=gregorian" → "de-DE"
    const tag = raw?.split(/[.@]/)[0].replace(/_/g, "-");
    if (!tag || tag === "C" || tag === "POSIX") continue;
    try {
      cached = new Intl.Locale(tag).toString();
      return cached;
    } catch {
      // not a valid tag
    }
  }
  cached = Intl.DateTimeFormat().resolvedOptions().locale;
  return cached;
}

/** Work days as JS weekdays (0 = Sunday): every day that isn't the locale's weekend. Mon–Fri if unknown. */
export function localeWorkDays(locale = macLocale()): number[] {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { weekend: number[] };
      weekInfo?: { weekend: number[] };
    };
    const weekend = (l.getWeekInfo?.() ?? l.weekInfo)?.weekend;
    if (weekend?.length) {
      const off = new Set(weekend.map((d) => d % 7)); // ISO 1 = Mon … 7 = Sun → JS 0 = Sun … 6 = Sat
      const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => !off.has(d));
      if (days.length) return days;
    }
  } catch {
    // fall through
  }
  return [1, 2, 3, 4, 5];
}

/** True when the locale writes the day before the month (11/12 = 11 December). */
export function localeDayFirst(locale = macLocale()): boolean {
  try {
    const types = new Intl.DateTimeFormat(locale).formatToParts(new Date(2000, 11, 31)).map((p) => p.type);
    return types.indexOf("day") < types.indexOf("month");
  } catch {
    return false;
  }
}
