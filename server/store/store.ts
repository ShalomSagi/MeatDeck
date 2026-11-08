// The store: one object over state.json that every server module reads and writes. The logic per
// entity lives in the sibling modules (todos.ts, notes.ts, projects.ts…), which take the store as
// their first argument; this class only holds the state, saves it and emits "change".
import { EventEmitter } from "node:events";
import type { Brief, ChangeEvent, Day, RunKind, UsageLimits } from "../../shared/types.ts";
import * as days from "./days.ts";
import * as integrations from "./integrations.ts";
import * as items from "./items.ts";
import * as messages from "./messages.ts";
import * as notes from "./notes.ts";
import { loadState, writeState, type GhSeen, type Persisted, type RunSummary } from "./persistence.ts";
import * as projects from "./projects.ts";
import * as queue from "./queueOverrides.ts";
import * as refs from "./refs.ts";
import * as reviewAsks from "./reviewAsks.ts";
import * as rules from "./rules.ts";
import * as settings from "./settings.ts";
import * as settle from "./settle.ts";
import * as suggestions from "./suggestions.ts";
import * as todos from "./todos.ts";
import * as voice from "./voice.ts";
import { now } from "./helpers.ts";

/** A domain function's arguments after the store itself. */
type Args<F> = F extends (s: Store, ...rest: infer A) => unknown ? A : never;

export class Store extends EventEmitter {
  /** The persisted state. Read and changed by the domain modules in this folder only. */
  data: Persisted;

  constructor() {
    super();
    this.data = loadState();
    // Linear projects from items stored before projects existed (no-op once they exist).
    projects.ensureLinearProjects(this, this.data.items);
    refs.backfillRefs(this);
  }

  save() {
    writeState(this.data);
    this.emit("change");
  }

  // ---- days ----
  today(): Day {
    return days.today(this);
  }
  history(...a: Args<typeof days.history>) {
    return days.history(this, ...a);
  }
  allDays(): Day[] {
    return days.allDays(this);
  }
  day(date: string): Day | undefined {
    return this.data.days[date];
  }
  setBrief(input: Omit<Brief, "generatedAt">) {
    this.today().brief = { ...input, generatedAt: now() };
    this.save();
  }

  // ---- settings ----
  settings() {
    return settings.settings(this);
  }
  updateSettings(...a: Args<typeof settings.updateSettings>) {
    return settings.updateSettings(this, ...a);
  }

  // ---- runs, limits, GitHub snapshot, change events ----
  runs(): RunSummary[] {
    return this.data.runs ?? [];
  }

  recordRun(run: RunSummary) {
    const runs = (this.data.runs ?? []).filter((r) => r.id !== run.id);
    this.data.runs = [run, ...runs].slice(0, 300); // kept for per-kind usage stats
    if (run.status === "running") this.data.lastRun = { ...this.data.lastRun, [run.kind]: run.startedAt };
    this.save();
  }

  limits(): UsageLimits | undefined {
    return this.data.limits;
  }

  setLimits(limits: UsageLimits) {
    this.data.limits = limits;
    this.save();
  }

  lastRun(kind: RunKind): string | undefined {
    return this.data.lastRun?.[kind];
  }

  ghSeen(): Record<string, GhSeen> | undefined {
    return this.data.ghSeen;
  }

  setGhSeen(seen: Record<string, GhSeen>) {
    // Polled every 30s: only write (and wake the UI) when something actually changed.
    if (JSON.stringify(this.data.ghSeen ?? {}) === JSON.stringify(seen)) return;
    this.data.ghSeen = seen;
    this.save();
  }

  events(): ChangeEvent[] {
    return this.data.events ?? [];
  }

  addEvents(events: ChangeEvent[]) {
    if (!events.length) return;
    this.data.events = [...events, ...(this.data.events ?? [])].slice(0, 200);
    this.save();
  }

  // ---- GitHub outcomes ----
  settleCiTodos(...a: Args<typeof settle.settleCiTodos>) {
    return settle.settleCiTodos(this, ...a);
  }
  closeAsDone(...a: Args<typeof settle.closeAsDone>) {
    return settle.closeAsDone(this, ...a);
  }
  settleUrl(...a: Args<typeof settle.settleUrl>) {
    return settle.settleUrl(this, ...a);
  }

  // ---- todos ----
  addTodos(...a: Args<typeof todos.addTodos>) {
    return todos.addTodos(this, ...a);
  }
  updateTodo(...a: Args<typeof todos.updateTodo>) {
    return todos.updateTodo(this, ...a);
  }
  removeTodo(...a: Args<typeof todos.removeTodo>) {
    return todos.removeTodo(this, ...a);
  }
  reorderTodos(...a: Args<typeof todos.reorderTodos>) {
    return todos.reorderTodos(this, ...a);
  }

  // ---- priorities (Claude's judgment), snoozes and dismissals (yours) ----
  priorities() {
    return queue.priorities(this);
  }
  setPriorities(...a: Args<typeof queue.setPriorities>) {
    return queue.setPriorities(this, ...a);
  }
  clearPriority(...a: Args<typeof queue.clearPriority>) {
    return queue.clearPriority(this, ...a);
  }
  snoozes() {
    return queue.snoozes(this);
  }
  snooze(...a: Args<typeof queue.snooze>) {
    return queue.snooze(this, ...a);
  }
  dismissals() {
    return queue.dismissals(this);
  }
  dismiss(...a: Args<typeof queue.dismiss>) {
    return queue.dismiss(this, ...a);
  }
  undismiss(...a: Args<typeof queue.undismiss>) {
    return queue.undismiss(this, ...a);
  }

  // ---- voice ----
  voiceState() {
    return voice.voiceState(this);
  }
  setVoice(...a: Args<typeof voice.setVoice>) {
    return voice.setVoice(this, ...a);
  }

  // ---- rules ----
  rules() {
    return rules.rules(this);
  }
  addRule(...a: Args<typeof rules.addRule>) {
    return rules.addRule(this, ...a);
  }
  updateRule(...a: Args<typeof rules.updateRule>) {
    return rules.updateRule(this, ...a);
  }
  removeRule(...a: Args<typeof rules.removeRule>) {
    return rules.removeRule(this, ...a);
  }
  preferences() {
    return rules.preferences(this);
  }
  addPreference(...a: Args<typeof rules.addPreference>) {
    return rules.addPreference(this, ...a);
  }
  removePreference(...a: Args<typeof rules.removePreference>) {
    return rules.removePreference(this, ...a);
  }

  // ---- notes ----
  notes() {
    return notes.notes(this);
  }
  note(...a: Args<typeof notes.getNote>) {
    return notes.getNote(this, ...a);
  }
  createNote(...a: Args<typeof notes.createNote>) {
    return notes.createNote(this, ...a);
  }
  updateNote(...a: Args<typeof notes.updateNote>) {
    return notes.updateNote(this, ...a);
  }
  deleteNote(...a: Args<typeof notes.deleteNote>) {
    return notes.deleteNote(this, ...a);
  }

  // ---- messages ----
  addMessages(...a: Args<typeof messages.addMessages>) {
    return messages.addMessages(this, ...a);
  }
  updateMessage(...a: Args<typeof messages.updateMessage>) {
    return messages.updateMessage(this, ...a);
  }
  sentLog() {
    return messages.sentLog(this);
  }

  // ---- review asks ----
  reviewAsks() {
    return reviewAsks.reviewAsks(this);
  }
  reviewAskChecked() {
    return reviewAsks.reviewAskChecked(this);
  }
  reviewAskLog() {
    return reviewAsks.reviewAskLog(this);
  }
  recordReviewAsk(...a: Args<typeof reviewAsks.recordReviewAsk>) {
    return reviewAsks.recordReviewAsk(this, ...a);
  }
  markReviewAskChecked(...a: Args<typeof reviewAsks.markReviewAskChecked>) {
    return reviewAsks.markReviewAskChecked(this, ...a);
  }

  // ---- open items ----
  items() {
    return this.data.items;
  }
  upsertItems(...a: Args<typeof items.upsertItems>) {
    return items.upsertItems(this, ...a);
  }
  isHiddenItem(...a: Args<typeof items.isHiddenItem>) {
    return items.isHiddenItem(this, ...a);
  }
  removeItem(...a: Args<typeof items.removeItem>) {
    return items.removeItem(this, ...a);
  }

  // ---- integrations ----
  integrations() {
    return integrations.integrations(this);
  }
  integration(...a: Args<typeof integrations.integration>) {
    return integrations.integration(this, ...a);
  }
  saveIntegration(...a: Args<typeof integrations.saveIntegration>) {
    return integrations.saveIntegration(this, ...a);
  }
  deleteIntegration(...a: Args<typeof integrations.deleteIntegration>) {
    return integrations.deleteIntegration(this, ...a);
  }

  // ---- readable ids ("N-12") ----
  nextRef(...a: Args<typeof refs.nextRef>) {
    return refs.nextRef(this, ...a);
  }

  // ---- projects ----
  projects() {
    return projects.projects(this);
  }
  links() {
    return projects.links(this);
  }
  createProject(...a: Args<typeof projects.createProject>) {
    return projects.createProject(this, ...a);
  }
  updateProject(...a: Args<typeof projects.updateProject>) {
    return projects.updateProject(this, ...a);
  }
  deleteProject(...a: Args<typeof projects.deleteProject>) {
    return projects.deleteProject(this, ...a);
  }
  linkToProject(...a: Args<typeof projects.linkToProject>) {
    return projects.linkToProject(this, ...a);
  }

  // ---- suggestions ----
  suggestions() {
    return suggestions.suggestions(this);
  }
  addSuggestion(...a: Args<typeof suggestions.addSuggestion>) {
    return suggestions.addSuggestion(this, ...a);
  }
  acceptSuggestion(...a: Args<typeof suggestions.acceptSuggestion>) {
    return suggestions.acceptSuggestion(this, ...a);
  }
  dismissSuggestion(...a: Args<typeof suggestions.dismissSuggestion>) {
    return suggestions.dismissSuggestion(this, ...a);
  }
}

export const store = new Store();
