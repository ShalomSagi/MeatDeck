// Shared between the server, the MCP bridge and the web UI.
import type { Integration, IntegrationStatus } from "./integrations.ts";
import type { ProviderId, ProviderStatus } from "./providers.ts";

export type Source = "github" | "linear" | "slack" | "calendar" | "notion" | "manual" | "other";

type Priority = "p0" | "p1" | "p2";

export interface Todo {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  id: string;
  title: string;
  notes?: string;
  source: Source;
  url?: string;
  priority: Priority;
  status: "open" | "done" | "skipped";
  /** "auto" = created by deterministic code (e.g. a GitHub state change), no tokens spent. */
  createdBy: "claude" | "me" | "auto";
  /** ISO date the todo was first created on, set when it rolls over into a later day. */
  carriedFrom?: string;
  /** Optional link to an open item (OpenItem.id) this todo moves forward. */
  itemId?: string;
  /** Came from a note: the note and its checkbox (ticking either side ticks both). */
  noteId?: string;
  noteItemId?: string;
  /** YYYY-MM-DD, parsed from "@tomorrow", "@fri", "@2026-11-12" or set by Claude. */
  due?: string;
  createdAt: string;
  doneAt?: string;
}

type MessageChannel = "slack" | "github" | "linear" | "email" | "other";

export interface Message {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  id: string;
  /** Human-readable recipient: "Alex", "#team-platform". */
  to: string;
  channel: MessageChannel;
  /** Machine target Claude can send to later: Slack user/channel id, PR URL, issue id. */
  target?: string;
  /** Slack thread ts, when the reply belongs in a thread. */
  threadTs?: string;
  text: string;
  /** Why this message is needed: "PR #812 has been waiting on Alex's re-review for 2 days". */
  reason: string;
  url?: string;
  status: "draft" | "approved" | "sent" | "dismissed";
  createdAt: string;
  sentAt?: string;
  /** Claude's latest wording. If what you send differs, the pair teaches your voice. */
  draftedText?: string;
}

export type ItemState = "needs_me" | "waiting" | "blocked" | "in_progress" | "done";

export interface OpenItem {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  /** Stable id: "github:org/repo#812", "linear:ENG-123", "slack:C123/1712.33". */
  id: string;
  source: Source;
  kind: "pr" | "review" | "issue" | "thread" | "meeting" | "other";
  title: string;
  url?: string;
  state: ItemState;
  /** Free-text status line: "2 approvals, CI red", "In Review". */
  status?: string;
  /** Who it waits on, when state is waiting/blocked. */
  waitingOn?: string;
  /** Source-side grouping label: the Linear project name, or the Slack channel. Used by project rules. */
  project?: string;
  /** GitHub repo ("owner/name") when the item lives in code. */
  repo?: string;
  note?: string;
  updatedAt: string;
}

export interface Brief {
  summary: string;
  highlights: string[];
  generatedAt: string;
}

export interface Day {
  date: string;
  brief?: Brief;
  todos: Todo[];
  messages: Message[];
}

export interface GithubPr {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  author: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  checks: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "EXPECTED" | null;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  pendingReviewers: string[];
  approvedBy: string[];
  changesRequestedBy: string[];
  unresolvedThreads: number;
  /** Branches, so stacked PRs (one PR's base is another's head) can be grouped. */
  baseRef?: string;
  headRef?: string;
  /** Each human reviewer's latest review (any state, incl. COMMENTED) and when they left it. */
  reviews?: { login: string; state: string; at: string }[];
  /** Names of failing checks (after ignore rules), for display and for Claude. */
  failingChecks?: string[];
  /** Checks that failed but an ignore rule says not to count them. */
  ignoredFailures?: string[];
}

export interface GithubSnapshot {
  login?: string;
  fetchedAt?: string;
  error?: string;
  mine: GithubPr[];
  reviewRequests: GithubPr[];
  /** GitHub GraphQL budget after the last refresh (shared with every other gh user on this Mac). */
  rate?: { remaining: number; resetAt: string };
}

export type RunKind = "morning" | "pulse" | "manual" | "send" | "wrapup" | "project" | "revise" | "voice" | "linear";

// ---------- notes ----------

/** A Notion-like note. `doc` is the editor's JSON; `text` is a plain-text rendering kept for Claude and search. */
export interface Note {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  id: string;
  title: string;
  kind: "note" | "meeting";
  /** Notion-style page icon: one emoji. Missing = the kind's default icon. */
  icon?: string;
  doc: unknown;
  text: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the sidebar/list needs (the doc itself is fetched per note). */
export interface NoteMeta {
  id: string;
  ref?: string;
  title: string;
  kind: Note["kind"];
  icon?: string;
  pinned?: boolean;
  updatedAt: string;
  createdAt: string;
  openActions: number;
  doneActions: number;
  projectIds: string[];
  preview: string;
}

/** Token counts as Claude reports them. `total` = all four summed. */
export interface Tokens {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  total: number;
}

export interface RunUsage extends Tokens {
  costUsd?: number;
  models: string[];
  sessionId?: string;
}

/** Claude subscription limit windows, read from `rate_limit_event` in MeatDeck's own run streams (free). */
export interface UsageLimits {
  at: string;
  windows: { id: "five_hour" | "seven_day"; label: string; usedPercent: number; resetsAt?: string; minutes: number }[];
  overage?: { status: string; usingOverage: boolean };
}

export interface UsageSummary {
  scannedAt?: string;
  scanning: boolean;
  limits?: UsageLimits;
  /** MeatDeck = sessions MeatDeck ran; all = every Claude Code session on this Mac (incl. T3 Code). */
  windows: Record<"last5h" | "today" | "last7d" | "last30d", { meatdeck: Tokens; all: Tokens }>;
  daily: { date: string; meatdeck: number; all: number }[];
  byProject: { name: string; tokens: number; meatdeck: boolean }[];
  byModel: { model: string; all: number; meatdeck: number }[];
  /** From MeatDeck's run records (last 7 days): what each kind of run costs. */
  byRunKind: { kind: RunKind; runs: number; tokens: number; output: number; costUsd: number }[];
}

export interface ClaudeRun {
  id: string;
  kind: RunKind;
  /** Short human label: "Morning brief", "Send to Alex". */
  label: string;
  startedAt: string;
  finishedAt?: string;
  status: "queued" | "running" | "done" | "failed";
  /** Who started it. */
  trigger: "schedule" | "you" | "startup";
  /** Last line Claude said, for the runs list. */
  summary?: string;
  /** For targeted runs (revise): "message:<id>" / "todo:<id>", so the UI can show it on that card. */
  target?: string;
  /** For revise runs: what you asked for. */
  instruction?: string;
  usage?: RunUsage;
  log: string;
}

export interface Settings {
  /** Full /today brief once a day, on work days, at or after `time`. */
  morning: { enabled: boolean; time: string; days: number[] };
  /** Lighter check for what changed, every `everyMinutes` between from and to on work days. */
  pulse: { enabled: boolean; everyMinutes: number; from: string; to: string };
  /** End-of-day wrap-up. */
  wrapup: { enabled: boolean; time: string };
  /** Optional model override for headless runs ("" = Claude Code default). */
  model: string;
  /** Small model for frequent or narrow runs: pulse checks and "Change…" revisions. */
  pulseModel: string;
  /** Default model for the chat composer (picker can override per chat). */
  chatModel: string;
  /** Which provider chatModel belongs to (default Claude). */
  chatProvider?: ProviderId;
  /** Default reasoning level for chat ("" / undefined = the model's own default). */
  chatEffort?: string;
  /** Agent CLIs MeatDeck may use (Settings → Providers). Missing = enabled. */
  providers?: Partial<Record<ProviderId, { enabled: boolean }>>;
  /** Tools you chose "Always allow" for when Claude asked (added to every run's allowlist). */
  alwaysAllowTools?: string[];
  /** Skip scheduled pulse/wrap-up runs while the Mac has been idle this many minutes (0 = never skip). */
  skipWhenIdleMinutes: number;
  /** GitHub repos ("owner/name") to hide and never spend tokens on. Projects have their own `ignored` flag. */
  ignoredRepos: string[];
}

/** Something deterministic code noticed (no tokens). Fed to Claude as "changes since last run". */
export interface ChangeEvent {
  at: string;
  text: string;
  url?: string;
}

export const isBot = (login: string) => /\[bot\]$|^(dependabot|renovate|github-actions)/i.test(login);

/** Is a newer build of MeatDeck ready (server/updates.ts)? */
export interface UpdateStatus {
  state: "current" | "available" | "updating" | "failed" | "error" | "unsupported";
  /** "source": rebuilds from a local folder; "release": installs from GitHub Releases. */
  channel?: "source" | "release";
  version?: string;
  builtAt?: string;
  /** Source folder the app rebuilds from (source channel). */
  repo?: string;
  /** "owner/repo" whose releases it installs (release channel), and what's there. */
  github?: string;
  latest?: string;
  notes?: string;
  releaseUrl?: string;
  /** While updating: "Downloading 0.2.0…", "Restarting…". */
  progress?: string;
  /** Source files that differ from the running build. */
  changed: string[];
  checkedAt?: string;
  startedAt?: string;
  /** Source fingerprint of the failed attempt: stays failed until the source changes again. */
  failedHash?: string;
  message?: string;
}

export interface DashboardState {
  today: string;
  day: Day;
  items: OpenItem[];
  github: GithubSnapshot;
  run?: ClaudeRun;
  runs: Omit<ClaudeRun, "log">[];
  settings: Settings;
  nextRuns: { kind: RunKind; at: string; target?: string }[];
  /** Rules Claude learned from your corrections ("Change…"); applied on every run. */
  preferences: Preference[];
  /** Rules every Claude run follows; some are also enforced in code (ignore_check). */
  rules: Rule[];
  /** What you sent, by the url it was about (last 14 days): turns "nudge X" / "reply to X" into "waiting on X". */
  sent: Record<string, { at: string; to: string }>;
  /** Claude's pending suggestions (new projects for active work it noticed). */
  suggestions: Suggestion[];
  /** Services MeatDeck talks to, and how (see shared/integrations.ts). */
  integrations: (Integration & { status: IntegrationStatus })[];
  /** Claude is waiting for your OK to use a tool it wasn't pre-allowed. */
  permissions: PermissionRequest[];
  voice: VoiceState;
  chats: ChatMeta[];
  /** Claude's priority judgments, by action key (see shared/actions.ts). */
  priorities: Record<string, { tier: "now" | "today" | "watch"; why: string; score?: number; at: string }>;
  /** Action key → hidden until this date (YYYY-MM-DD). */
  snoozes: Record<string, string>;
  /** Review asks per PR url (latest), when Claude last looked for asks on each PR, and where you've asked before. */
  reviewAsks: Record<string, ReviewAsk>;
  reviewAskChecked: Record<string, string>;
  reviewAskLog: { repo: string; where: string; at: string }[];
  /** Rows you dismissed for good ("don't do this / don't remind me"), by action key. */
  dismissed: Record<string, Dismissal>;
  events: ChangeEvent[];
  usage: UsageSummary;
  /** Agent CLIs on this Mac and the models each offers (probed by code, no tokens). */
  providers: ProviderStatus[];
  update: UpdateStatus;
  projects: Project[];
  notes: NoteMeta[];
  /** Explicit entity → project links Claude made (entity key = PR url, item id, or "todo:<id>"). */
  projectLinks: Record<string, string[]>;
  history: { date: string; done: number; total: number }[];
}

// ---------- projects (conceptual work streams; repos are separate: they're where code lives) ----------

/** Matching rules Claude learns once and code applies forever after, so grouping costs no tokens. */
export interface ProjectRules {
  /** Every PR in these repos ("owner/name") belongs. Only for repos dedicated to the project. */
  repos: string[];
  /** Linear project names. */
  linearProjects: string[];
  /** Ticket keys (ENG-142). Matches Linear items and any PR/todo/thread mentioning the key. */
  linearIssues: string[];
  /** Slack channel names, without "#". */
  slackChannels: string[];
  /** Distinctive phrases matched in titles (3+ chars; avoid generic words). */
  keywords: string[];
}

export interface Project {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  id: string;
  name: string;
  /** Written by you: what the project is, in plain words. Claude uses it to find related work. */
  description: string;
  kind: "manual" | "linear";
  ignored?: boolean;
  rules: ProjectRules;
  /** Claude-maintained snapshot: status, people, blockers, links. */
  context?: { summary: string; updatedAt: string };
  lastDiscoveryAt?: string;
  /** Linear projects: link, and when the description was last pulled from Linear. */
  url?: string;
  linearSyncedAt?: string;
  /** Linear's priority for the project (0 none, 1 urgent, 2 high, 3 medium, 4 low), copied on sync. */
  linearPriority?: number;
  /** Your MeatDeck priority (same scale). Overrides Linear's; unset = follow Linear. */
  priority?: number;
  createdAt: string;
  updatedAt: string;
}

/** A rule learned from a correction, e.g. "When a thread continued in DM, follow up in that DM". */
export interface Preference {
  id: string;
  text: string;
  /** The correction it came from. */
  from?: string;
  createdAt: string;
}

/** How the user writes, so drafts sound like them. */
export interface VoiceProfile {
  /** Short style guide (Claude-written, user-editable). */
  guide: string;
  /** A few real messages of theirs that show the voice. */
  examples: string[];
  updatedAt: string;
  /** What it was learned from. */
  sources?: { slack?: number; github?: number; edits?: number };
}

/** "Claude drafted X, the user actually sent Y": the clearest voice signal there is. */
export interface VoiceEdit {
  drafted: string;
  sent: string;
  to: string;
  at: string;
}

export interface VoiceState {
  profile?: VoiceProfile;
  edits: VoiceEdit[];
  /** Edits collected since the profile was last learned. */
  newEdits: number;
}

// ---------- chat (the composer) ----------

/** What a message is about: the page you were on, or an @-mention. */
export type ContextRef =
  | { type: "today" }
  | { type: "work" }
  | { type: "project"; id: string }
  | { type: "note"; id: string }
  | { type: "repo"; repo: string }
  /** A row of the action queue ("Chat about this"). Title is kept for the chip if the row goes away. */
  | { type: "action"; key: string; title: string }
  /** A drafted message ("Chat about this" on its card). */
  | { type: "draft"; id: string; title: string };

/** Something a chat turn produced, shown as a clickable card. */
export type ChatArtifact =
  | { kind: "note"; id: string; title: string; created: boolean }
  | { kind: "todos"; ids: string[]; titles: string[] }
  | { kind: "drafts"; ids: string[]; to: string[] }
  | { kind: "sent"; to: string; channel: string; text: string }
  | { kind: "link"; url: string; title: string };

/** One tool call in a chat reply. */
export interface WorkEntry {
  id: string;
  /** Raw tool name ("Bash", "mcp__meatdeck__create_doc", "mcp__claude_ai_Slack__slack_search_public"). */
  tool: string;
  /** Short hint from its input: the command, query, id… */
  detail?: string;
  status: "running" | "done" | "error";
  error?: string;
  at: string;
  endedAt?: string;
}

export type ReplyPart = { kind: "text"; text: string } | { kind: "work"; entries: WorkEntry[] };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  /** user turns: what was attached. */
  context?: ContextRef[];
  /** assistant turns: tool steps ("Notion · search  cutover"), artifacts, status, cost. Older chats only. */
  steps?: string[];
  /** assistant turns: text and tool calls in the order they happened (T3-style timeline). */
  parts?: ReplyPart[];
  finishedAt?: string;
  artifacts?: ChatArtifact[];
  status?: "running" | "done" | "failed" | "stopped";
  usage?: { tokens: number; costUsd?: number };
}

export interface Chat {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  id: string;
  title: string;
  model: string;
  /** Provider the chat's next turn runs on (missing = Claude, for older chats). */
  provider?: ProviderId;
  effort?: string;
  /** The provider's session/thread id, for resuming. */
  sessionId?: string;
  /** Which provider `sessionId` belongs to; switching providers starts a new session with a recap. */
  sessionProvider?: ProviderId;
  /** Everything attached so far (the page the chat started on, mentions…): every turn sees it. */
  context?: ContextRef[];
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatMeta {
  id: string;
  ref?: string;
  title: string;
  model: string;
  provider?: ProviderId;
  effort?: string;
  context?: ContextRef[];
  updatedAt: string;
  running: boolean;
  messageCount: number;
}

/**
 * A standing rule. "instruction" goes into every Claude run's prompt. "ignore_check" is enforced
 * by code: CI checks whose name matches `pattern` (case-insensitive, `*` wildcard) never count as
 * failing, so no "Fix CI" items get created for them.
 */
export interface Rule {
  /** Short human id ("N-12"), shown in the UI and resolvable by any Claude via the meatdeck MCP lookup tool. */
  ref?: string;
  id: string;
  kind: "instruction" | "ignore_check";
  text: string;
  pattern?: string;
  enabled: boolean;
  /** Who added it: you in Settings, Claude in chat at your request, or learned from a correction. */
  by: "you" | "chat" | "learned";
  from?: string;
  createdAt: string;
}

export interface PermissionRequest {
  id: string;
  tool: string;
  /** Short human summary of the call ("Claude Docs · batch", the Bash command…). */
  summary: string;
  input: unknown;
  /** Which chat or run asked, when known. */
  chatId?: string;
  run?: string;
  at: string;
}

/** Readable id prefixes. */
const REF_PREFIX = {
  note: "N",
  project: "P",
  todo: "T",
  draft: "D",
  item: "I",
  rule: "R",
  chat: "C",
  suggestion: "S",
} as const;
export type RefPrefix = (typeof REF_PREFIX)[keyof typeof REF_PREFIX];

/** You asked for a review of your PR in Slack (or anywhere a message with its link went out). */
export interface ReviewAsk {
  at: string;
  /** "#code-reviews", "Alex", "DM with Sam". */
  where: string;
  link?: string;
  /** "meatdeck": a message MeatDeck sent; "slack": Claude found it in Slack. */
  by: "meatdeck" | "slack";
}

/** "Not this, and stop reminding me." Unlike a snooze, it doesn't come back tomorrow. */
export interface Dismissal {
  key: string;
  /** The step you dismissed. A PR row with a different step later (fix → merge) shows again. */
  verb: string;
  title: string;
  at: string;
  /** What dismissing closed, so Restore can reopen it. */
  todoId?: string;
  messageId?: string;
  /** Marked done (✓) rather than dismissed (✕): shows under "Done today" instead of "Dismissed". */
  done?: boolean;
}

/**
 * Something Claude noticed while syncing that the user may want to act on: for now, a new project
 * for active work no project covers. Claude only proposes; the user accepts or dismisses.
 */
export interface Suggestion {
  ref?: string;
  id: string;
  kind: "project";
  name: string;
  description: string;
  /** One line: why this looks like active work, e.g. "You and Alex shipped 2 PRs and planned a Thursday release in #app". */
  why: string;
  /** Concrete signals (a PR, an in-progress ticket, a dated plan in a thread). At least two. */
  evidence: { text: string; url?: string }[];
  /** How to recognise its work, applied on accept (ticket keys, channels, keywords, repos). */
  rules?: Partial<ProjectRules>;
  /** Specific things to attach on accept (PR urls, item ids). */
  keys?: string[];
  status: "pending" | "accepted" | "dismissed";
  projectId?: string;
  createdAt: string;
  decidedAt?: string;
}
