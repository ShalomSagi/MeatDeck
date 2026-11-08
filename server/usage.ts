// Token usage, computed from Claude Code's own transcripts in ~/.claude/projects: zero tokens.
// Every assistant message there records its usage; MeatDeck's headless runs land in the
// project dir for its cwd (~/.meatdeck), so "MeatDeck" vs "everything else" is just a path check.
// Incremental: a per-file index keyed by size+mtime means only changed files get re-read.
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { createInterface } from "node:readline";
import type { RunKind, Tokens, UsageSummary } from "../shared/types.ts";
import { localDate } from "./store/helpers.ts";
import { DATA_DIR } from "./store/persistence.ts";
import { store } from "./store/store.ts";

const PROJECTS = join(homedir(), ".claude", "projects");
const INDEX_FILE = join(DATA_DIR, "usage-index.json");
// Claude Code names a project dir after its cwd with every non-alphanumeric char → "-".
const encode = (path: string) => path.replace(/[^a-zA-Z0-9]/g, "-");
const MEATDECK_DIRS = new Set([encode(DATA_DIR), encode(join(homedir(), ".work-dashboard"))]);

/** [input, cacheWrite, cacheRead, output] per `${localHour}|${model}`. */
type Buckets = Record<string, [number, number, number, number]>;
/** The fields read from one line of a Claude Code transcript (~/.claude/projects/**.jsonl). */
interface TranscriptLine {
  type?: string;
  requestId?: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens?: number;
    };
  };
}
interface FileEntry {
  size: number;
  mtimeMs: number;
  project: string;
  buckets: Buckets;
}
interface Index {
  version: 1;
  files: Record<string, FileEntry>;
}

let index: Index = loadIndex();
let scanning = false;
let scannedAt: string | undefined;

function loadIndex(): Index {
  try {
    const parsed = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
    if (parsed.version === 1) return parsed;
  } catch {}
  return { version: 1, files: {} };
}

function listJsonl(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listJsonl(p, out);
    else if (e.name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hourKey = (d: Date) => `${localDate(d)}T${pad(d.getHours())}`;

async function readFile(path: string): Promise<Buckets> {
  const buckets: Buckets = {};
  const seen = new Set<string | undefined>(); // one message is logged on several lines with the same usage
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    // Cheap prefilter before JSON.parse: most lines are tool output, not usage.
    if (!line.includes('"usage"') || !line.includes('"assistant"')) continue;
    let d: TranscriptLine;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const m = d.message;
    if (d.type !== "assistant" || !m?.usage || !m.model || m.model === "<synthetic>") continue;
    const id = m.id ?? d.requestId ?? d.uuid;
    if (seen.has(id)) continue;
    seen.add(id);
    const at = new Date(d.timestamp ?? Date.now());
    const key = `${hourKey(at)}|${m.model}`;
    const b = (buckets[key] ??= [0, 0, 0, 0]);
    b[0] += m.usage.input_tokens ?? 0;
    b[1] += m.usage.cache_creation_input_tokens ?? 0;
    b[2] += m.usage.cache_read_input_tokens ?? 0;
    b[3] += m.usage.output_tokens ?? 0;
  }
  return buckets;
}

/** Re-read only transcripts that changed since the last scan. */
export async function scanUsage(): Promise<void> {
  if (scanning || !existsSync(PROJECTS)) return;
  scanning = true;
  try {
    const files = listJsonl(PROJECTS);
    const live = new Set(files);
    for (const path of files) {
      let st;
      try {
        st = statSync(path);
      } catch {
        continue;
      }
      const prev = index.files[path];
      if (prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs) continue;
      const project = relative(PROJECTS, path).split(sep)[0];
      index.files[path] = { size: st.size, mtimeMs: st.mtimeMs, project, buckets: await readFile(path) };
      await new Promise((r) => setImmediate(r)); // keep the server responsive during the first big scan
    }
    for (const path of Object.keys(index.files)) if (!live.has(path)) delete index.files[path];
    writeFileSync(INDEX_FILE, JSON.stringify(index));
    scannedAt = new Date().toISOString();
  } finally {
    scanning = false;
  }
}

// ---------- aggregation ----------

const zero = (): Tokens => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 });
function add(t: Tokens, b: [number, number, number, number]) {
  t.input += b[0];
  t.cacheWrite += b[1];
  t.cacheRead += b[2];
  t.output += b[3];
  t.total += b[0] + b[1] + b[2] + b[3];
}

function projectLabel(dir: string): string {
  if (MEATDECK_DIRS.has(dir)) return "MeatDeck";
  const home = encode(homedir());
  let name = dir.startsWith(home) ? dir.slice(home.length) : dir;
  name = name.replace(/^-+/, "");
  if (name.startsWith("t3-scratch")) return "T3 Code scratch";
  if (name.startsWith("private-tmp-claude")) return "Claude scratchpads";
  name = name.replace(/^Users-Shared-/, "").replace(/^dev-/, "");
  return name || basename(dir);
}

export function usageSummary(): UsageSummary {
  const now = new Date();
  const today = localDate(now);
  const days = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return localDate(d);
  };
  const since7 = days(6);
  const since30 = days(29);
  const hour5 = hourKey(new Date(now.getTime() - 4 * 3_600_000)); // current hour + previous 4

  const windows: UsageSummary["windows"] = {
    last5h: { meatdeck: zero(), all: zero() },
    today: { meatdeck: zero(), all: zero() },
    last7d: { meatdeck: zero(), all: zero() },
    last30d: { meatdeck: zero(), all: zero() },
  };
  const daily = new Map<string, { meatdeck: number; all: number }>();
  for (let i = 13; i >= 0; i--) daily.set(days(i), { meatdeck: 0, all: 0 });
  const projects = new Map<string, number>();
  const models = new Map<string, { all: number; meatdeck: number }>();

  for (const f of Object.values(index.files)) {
    const isMeatDeck = MEATDECK_DIRS.has(f.project);
    for (const [key, b] of Object.entries(f.buckets)) {
      const [hour, model] = key.split("|");
      const date = hour.slice(0, 10);
      if (date < since30) continue;
      const sum = b[0] + b[1] + b[2] + b[3];
      const hit = (w: keyof typeof windows) => {
        add(windows[w].all, b);
        if (isMeatDeck) add(windows[w].meatdeck, b);
      };
      hit("last30d");
      if (date >= since7) {
        hit("last7d");
        projects.set(f.project, (projects.get(f.project) ?? 0) + sum);
        const m = models.get(model) ?? { all: 0, meatdeck: 0 };
        m.all += sum;
        if (isMeatDeck) m.meatdeck += sum;
        models.set(model, m);
      }
      if (date === today) hit("today");
      if (hour >= hour5) hit("last5h");
      const day = daily.get(date);
      if (day) {
        day.all += sum;
        if (isMeatDeck) day.meatdeck += sum;
      }
    }
  }

  // Per run kind, from MeatDeck's own run records (exact, includes cost).
  const kinds = new Map<RunKind, { runs: number; tokens: number; output: number; costUsd: number }>();
  const cutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  for (const r of store.runs()) {
    if (!r.usage || r.startedAt < cutoff) continue;
    const k = kinds.get(r.kind) ?? { runs: 0, tokens: 0, output: 0, costUsd: 0 };
    k.runs++;
    k.tokens += r.usage.total;
    k.output += r.usage.output;
    k.costUsd += r.usage.costUsd ?? 0;
    kinds.set(r.kind, k);
  }

  return {
    scannedAt,
    scanning,
    limits: store.limits(),
    windows,
    daily: [...daily.entries()].map(([date, v]) => ({ date, ...v })),
    byProject: [...projects.entries()]
      .map(([dir, tokens]) => ({ name: projectLabel(dir), tokens, meatdeck: MEATDECK_DIRS.has(dir) }))
      .reduce<{ name: string; tokens: number; meatdeck: boolean }[]>((acc, p) => {
        const hit = acc.find((x) => x.name === p.name);
        if (hit) hit.tokens += p.tokens;
        else acc.push(p);
        return acc;
      }, [])
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 8),
    byModel: [...models.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.all - a.all),
    byRunKind: [...kinds.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.tokens - a.tokens),
  };
}
