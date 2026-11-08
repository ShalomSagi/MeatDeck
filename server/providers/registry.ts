// Provider registry, modelled on T3 Code's (apps/server/src/provider): every agent CLI on this Mac
// is probed with zero-token calls and the result is cached in ~/.meatdeck/providers.json.
//   - Claude Code: `--version`, then the stream-json `initialize` control request (claude.ts).
//   - Codex: `--version`, then `codex app-server` JSON-RPC `model/list` + `account/read` (codex.ts).
//   - Cursor: `cursor-agent --version`, `status` and `models` (cursor.ts).
// Chat runs on any ready provider through the turn adapters in codex.ts and cursor.ts (one
// normalized event stream, agentTurn.ts).
import { EventEmitter } from "node:events";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROVIDER_IDS, PROVIDER_LABEL, type ProviderId, type ProviderStatus } from "../../shared/providers.ts";
import { DATA_DIR } from "../store/persistence.ts";
import { store } from "../store/store.ts";
import type { AgentEvent, TurnInput } from "./agentTurn.ts";
import { probeClaude } from "./claude.ts";
import { base } from "./cliProbe.ts";
import { codexEvents, codexTurnCommand, probeCodex } from "./codex.ts";
import { cursorParser, cursorTurnCommand, probeCursor } from "./cursor.ts";

const FILE = join(DATA_DIR, "providers.json");

export const providerEvents = new EventEmitter();

let cache: Partial<Record<ProviderId, ProviderStatus>> = (() => {
  try {
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
})();
const checking = new Set<ProviderId>();

function persist() {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache));
  renameSync(tmp, FILE);
}

function providerEnabled(id: ProviderId): boolean {
  return store.settings().providers?.[id]?.enabled ?? true;
}

/** What the UI shows: cached probe results, with the current enabled flag and in-flight state. */
export function providerStatuses(): ProviderStatus[] {
  return PROVIDER_IDS.map((id) => {
    const enabled = providerEnabled(id);
    const hit = cache[id] ?? {
      id,
      label: PROVIDER_LABEL[id],
      enabled,
      installed: false,
      status: "warning" as const,
      auth: { status: "unknown" as const },
      models: [],
      message: "Not checked yet.",
    };
    return { ...hit, enabled, ...(enabled ? {} : { status: "disabled" as const }), checking: checking.has(id) };
  });
}

export function providerStatus(id: ProviderId): ProviderStatus | undefined {
  return providerStatuses().find((p) => p.id === id);
}

const PROBES: Record<ProviderId, () => Promise<ProviderStatus>> = {
  claude: probeClaude,
  codex: probeCodex,
  cursor: probeCursor,
};

export async function refreshProvider(id: ProviderId): Promise<ProviderStatus | undefined> {
  if (checking.has(id)) return providerStatus(id);
  checking.add(id);
  providerEvents.emit("change");
  try {
    const s = await PROBES[id]();
    // Keep the last good model list if a probe comes back empty (offline, timeout).
    if (!s.models.length && cache[id]?.models.length) s.models = cache[id]!.models;
    cache[id] = s;
    persist();
  } catch (err) {
    cache[id] = {
      ...base(id),
      ...cache[id],
      status: "error",
      message: (err as Error).message,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    checking.delete(id);
    providerEvents.emit("change");
  }
  return providerStatus(id);
}

/** Probe enabled providers (all of them when `all`). Cheap: CLIs only, no model calls. */
export async function refreshProviders(all = false) {
  await Promise.all(PROVIDER_IDS.filter((id) => all || providerEnabled(id)).map(refreshProvider));
}

export function turnCommand(provider: Exclude<ProviderId, "claude">, t: TurnInput): { bin: string; args: string[] } {
  return provider === "codex" ? codexTurnCommand(t) : cursorTurnCommand(t);
}

/** Parse one stdout line into normalized events. Stateful per turn (Cursor repeats the full text at the end). */
export function turnParser(provider: Exclude<ProviderId, "claude">): (line: string) => AgentEvent[] {
  const cursor = cursorParser();
  return (line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return [];
    }
    return provider === "codex" ? codexEvents(parsed) : cursor(parsed);
  };
}
