// GitHub: refresh now, refresh on window focus, and review asks Claude found in Slack.
import type { Hono } from "hono";
import { changes } from "../changes.ts";
import { github } from "../github.ts";
import { lastPollAt, poll } from "../githubPolling.ts";
import { store } from "../store/store.ts";

export function registerGithubRoutes(app: Hono) {
  app.post("/api/github/refresh", async (c) => {
    await poll();
    return c.json(github);
  });
  /** The window came to the front: refresh unless we just did (looking at it should show the truth). */
  app.post("/api/github/peek", (c) => {
    if (Date.now() - lastPollAt() > 10_000) void poll();
    return c.json({ ok: true });
  });

  app.post("/api/review-asks", async (c) => {
    const { found = [], checked = [] } = (await c.req.json()) as {
      found?: { pr: string; where: string; at: string; link?: string }[];
      checked?: string[];
    };
    for (const f of found)
      if (f.pr && f.where && f.at) store.recordReviewAsk(f.pr, { at: f.at, where: f.where, link: f.link, by: "slack" });
    store.markReviewAskChecked([...checked, ...found.map((f) => f.pr)]);
    changes.emit("change");
    return c.json({ ok: true, recorded: found.length });
  });
}
