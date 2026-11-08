// Polling GitHub (plain gh, no tokens) at a pace that follows what the user is doing.
import { github } from "./github.ts";
import { changes } from "./changes.ts";
import { syncGithub } from "./reconcile.ts";
import { idleSeconds } from "./scheduler.ts";

// GitHub stays close to live: a refresh is one GraphQL call costing ~3 of the 5,000 points/hour
// (no tokens), so it runs every 30s while you're at the Mac, every 15s for a while after you act
// (start a fix in T3, re-run CI, merge, send), every 2 min when you're away, and right away when
// you switch to MeatDeck. The rate limit is shared with every gh user on this Mac (your agents too),
// so it backs off to 5 min when fewer than 1,000 points are left.
const ACTIVE_MS = 30_000;
const FAST_MS = 15_000;
const AWAY_MS = 2 * 60_000;
const LOW_BUDGET_MS = 5 * 60_000;
let lastPoll = 0;
let fastUntil = 0;
let polling = false;
export const poll = async () => {
  if (polling) return;
  polling = true;
  lastPoll = Date.now();
  try {
    const snap = () => JSON.stringify([github.mine, github.reviewRequests, github.error ?? ""]);
    const before = snap();
    await syncGithub();
    if (snap() !== before) changes.emit("change"); // the UI only re-renders when GitHub actually changed
  } finally {
    polling = false;
  }
};
/** When the last poll started (ms), so a peek doesn't refresh twice in a row. */
export function lastPollAt() {
  return lastPoll;
}
export function watchClosely(minutes = 20) {
  fastUntil = Math.max(fastUntil, Date.now() + minutes * 60_000);
}
let idle = { at: 0, away: false };
const away = () => {
  if (Date.now() - idle.at > 30_000) idle = { at: Date.now(), away: idleSeconds() > 5 * 60 };
  return idle.away;
};
const pollEvery = () => {
  if ((github.rate?.remaining ?? 5000) < 1000) return LOW_BUDGET_MS;
  if (Date.now() < fastUntil) return FAST_MS;
  return away() ? AWAY_MS : ACTIVE_MS;
};

export function startGithubPolling() {
  void poll();
  setInterval(() => {
    if (Date.now() - lastPoll >= pollEvery() - 1_000) void poll();
  }, 5_000);
}
