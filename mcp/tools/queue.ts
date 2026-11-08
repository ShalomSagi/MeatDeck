// The action queue: re-rank rows, act on a row, and record where the user asked for review.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ok } from "../api.ts";

export function registerQueueTools(server: McpServer) {
  server.registerTool(
    "record_review_asks",
    {
      description:
        "Record where the user asked for review of their PRs (a Slack message from them containing the PR link: a channel post or a DM). The digest's `prsToCheckForAsks` lists PRs to check. Do ONE Slack search for the user's own messages with GitHub PR links since the oldest PR's date, then call this with `found` (each PR whose link they shared: where = '#channel' or the DM person's name, at = message time ISO, link = permalink) and `checked` (every PR url you looked for, found or not). Reviewers GitHub assigned don't count as an ask.",
      inputSchema: {
        found: z
          .array(z.object({ pr: z.string(), where: z.string(), at: z.string(), link: z.string().optional() }))
          .optional(),
        checked: z.array(z.string()).optional(),
      },
    },
    async (body) => ok(await api("POST", "/api/review-asks", body)),
  );

  server.registerTool(
    "set_priorities",
    {
      description:
        "Re-rank items in the user's action queue using judgment the code can't have: Slack threads (\"release is waiting on this\"), Linear priority and dates, meeting docs, who's out. Keys come from the digest's `actions`. Only send the ones whose tier is wrong. Tier: now (do first), today, watch (fine to wait). `why` is one short line the user sees on the row.",
      inputSchema: {
        priorities: z.array(
          z.object({
            key: z.string(),
            tier: z.enum(["now", "today", "watch"]),
            why: z.string().describe("One line, specific: 'Sam needs this for Tuesday's release (Slack, Thu)'"),
            score: z.number().min(0).max(100).optional().describe("Fine ordering within the tier"),
          }),
        ),
      },
    },
    async (input) => {
      await api("POST", "/api/priorities", input);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "do_action",
    {
      description:
        "Act on a row of the user's action queue (keys come from get_dashboard → actions, e.g. 'pr:https://github.com/o/r/pull/12'). snooze: hide until tomorrow (still to do). dismiss: the user doesn't want to do it or hear about it again (only when they say so). done: the user says it's done (moves it to Done today; for PR rows only this step, a new step still shows). clear_priority: drop Claude's ranking. merge: merge the PR (only when the user asked). rerun_ci: re-run failed GitHub Actions jobs. start_in_t3: start a new T3 Code thread that works on it (fix CI, address review, resolve conflicts, review) in a fresh worktree. agent_prompt: get the ready-made prompt for that work.",
      inputSchema: {
        key: z.string(),
        action: z.enum([
          "snooze",
          "dismiss",
          "done",
          "clear_priority",
          "merge",
          "rerun_ci",
          "start_in_t3",
          "agent_prompt",
        ]),
      },
    },
    async ({ key, action }) => ok(await api("POST", "/api/actions/do", { key, action })),
  );
}
