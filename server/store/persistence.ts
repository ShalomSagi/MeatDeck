// The state file: ~/.meatdeck/state.json (or MEATDECK_HOME), its shape, and atomic load/save.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PriorityOverride } from "../../shared/actions.ts";
import type { Integration } from "../../shared/integrations.ts";
import type {
  ChangeEvent,
  ClaudeRun,
  Day,
  Dismissal,
  GithubPr,
  Note,
  OpenItem,
  Preference,
  Project,
  ReviewAsk,
  Rule,
  RunKind,
  Settings,
  Suggestion,
  UsageLimits,
  VoiceEdit,
  VoiceProfile,
} from "../../shared/types.ts";

export const DATA_DIR = process.env.MEATDECK_HOME ?? join(homedir(), ".meatdeck");
const STATE_FILE = join(DATA_DIR, "state.json");
mkdirSync(DATA_DIR, { recursive: true });

export type RunSummary = Omit<ClaudeRun, "log">;

export interface Persisted {
  days: Record<string, Day>;
  items: OpenItem[];
  settings?: Settings;
  runs?: RunSummary[];
  /** Last successful start per run kind (ISO), so the schedule survives restarts. */
  lastRun?: Partial<Record<RunKind, string>>;
  /** Last seen GitHub PR states, keyed by URL, for deterministic diffing across restarts. */
  ghSeen?: Record<string, GhSeen>;
  events?: ChangeEvent[];
  limits?: UsageLimits;
  projects?: Project[];
  notes?: Note[];
  preferences?: Preference[];
  rules?: Rule[];
  integrations?: Integration[];
  /** Next number per readable-id prefix (N, P, T, D, I, R, C). */
  refSeq?: Record<string, number>;
  voice?: VoiceProfile;
  priorities?: Record<string, PriorityOverride>;
  snoozes?: Record<string, string>;
  dismissed?: Record<string, Dismissal>;
  reviewAsks?: Record<string, ReviewAsk>;
  reviewAskChecked?: Record<string, string>;
  reviewAskLog?: { repo: string; where: string; at: string }[];
  voiceEdits?: VoiceEdit[];
  projectLinks?: Record<string, string[]>;
  suggestions?: Suggestion[];
  /** Sent messages by the url they were about (see DashboardState.sent). */
  sent?: Record<string, { at: string; to: string }>;
}

export interface GhSeen {
  role: "mine" | "review";
  repo: string;
  number: number;
  title: string;
  checks: GithubPr["checks"];
  reviewDecision: GithubPr["reviewDecision"];
  mergeable: GithubPr["mergeable"];
  approvedBy: string[];
  changesRequestedBy: string[];
  unresolvedThreads: number;
}

export function loadState(): Persisted {
  return existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, "utf8")) as Persisted) : { days: {}, items: [] };
}

export function writeState(data: Persisted) {
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, STATE_FILE);
}
