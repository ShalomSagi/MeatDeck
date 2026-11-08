// Reading MeatDeck: the digest, a past day, lookup by readable id, search; and writing today's brief.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ok } from "../api.ts";

export function registerDashboardTools(server: McpServer) {
  server.registerTool(
    "get_dashboard",
    {
      description:
        "Compact dashboard digest: now, last run times, today's brief, todos (s=status, p=priority, auto=created by code), drafted messages, tracked items, one line per GitHub PR (mine + review requests: ci, review, approvals, waiting reviewers, threads, conflicts), and changesSinceLastRun noticed by code. Scheduled runs already get this in their prompt; call it only if you don't have it.",
      inputSchema: {},
    },
    async () => ok(await api("GET", "/api/digest")),
  );

  server.registerTool(
    "lookup",
    {
      description:
        "Read anything in MeatDeck by its id: N-12 (doc: full text + its action items), P-3 (project: description, where it stands, next actions, docs), T-45 (todo), D-7 (draft message), I-9 (tracked Linear/Slack item), R-2 (rule), C-5 (chat transcript). Returns readable text with related ids you can look up next.",
      inputSchema: { id: z.string().describe('e.g. "N-12", "meatdeck P-3", "T45"') },
    },
    async ({ id }) => {
      try {
        const r = await api("GET", `/api/lookup/${encodeURIComponent(id)}`);
        return { content: [{ type: "text" as const, text: r.text }] };
      } catch {
        return {
          content: [
            { type: "text" as const, text: `Nothing in MeatDeck has id "${id}". Try search with words from it.` },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "search",
    {
      description:
        "Find MeatDeck docs, projects, todos, drafts, tracked items, rules and chats by words. Returns ids and titles; read one with lookup.",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => ok(await api("GET", `/api/search?q=${encodeURIComponent(query)}`)),
  );

  server.registerTool(
    "get_day",
    { description: "Read a past day (YYYY-MM-DD): its brief, todos and messages.", inputSchema: { date: z.string() } },
    async ({ date }) => ok(await api("GET", `/api/day/${date}`)),
  );

  server.registerTool(
    "set_brief",
    {
      description:
        "Write today's brief shown at the top of the dashboard. Keep summary to 2-4 sentences; highlights are short one-liners (risks, deadlines, things blocked on others).",
      inputSchema: { summary: z.string(), highlights: z.array(z.string()).default([]) },
    },
    async (input) => {
      await api("POST", "/api/brief", input);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "refresh_github",
    {
      description:
        "Re-fetch GitHub PR state now (it refreshes every 5 minutes and right before every scheduled run, so rarely needed). Returns the updated digest's github section.",
      inputSchema: {},
    },
    async () => {
      await api("POST", "/api/github/refresh", {});
      const d = await api("GET", "/api/digest");
      return ok({ github: d.github, changesSinceLastRun: d.changesSinceLastRun });
    },
  );
}
