// Integrations: services MeatDeck talks to, and how. Run an action, read the catalog, save one.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DashboardState } from "../../shared/types.ts";
import { api, ok } from "../api.ts";

export function registerIntegrationTools(server: McpServer) {
  server.registerTool(
    "run_integration_action",
    {
      description:
        "Perform an action of one of the user's integrations (see the integrations block in your prompt for which integration does what). Read actions are always allowed; write actions (send, merge, create…) only in runs allowed to write.",
      inputSchema: {
        integration: z.string().describe('Integration id, e.g. "github", "jira"'),
        action: z.string().describe('Action id, e.g. "readPullRequestComments", "listMyIssues"'),
        input: z.record(z.string(), z.string()).optional(),
      },
    },
    async ({ integration, action, input }) => {
      const r = await api("POST", `/api/integrations/${encodeURIComponent(integration)}/run`, {
        action,
        input: input ?? {},
        allowWrite: process.env.MEATDECK_WRITE === "1",
      }).catch((e: Error) => ({ ok: false, error: e.message }));
      if (!r.ok) return { content: [{ type: "text" as const, text: `Failed: ${r.error}` }], isError: true };
      return {
        content: [{ type: "text" as const, text: typeof r.output === "string" ? r.output : JSON.stringify(r.output) }],
      };
    },
  );

  server.registerTool(
    "list_integrations",
    {
      description:
        "The integration catalog: categories (code hosting, issue tracker, messaging, docs, calendar, CI), the actions each must implement (inputs, what to return), and the user's current integrations with how each action is implemented. Read this before creating or editing an integration.",
      inputSchema: {},
    },
    async () => {
      const [integrations, catalog]: [DashboardState["integrations"], unknown] = await Promise.all([
        api("GET", "/api/integrations"),
        api("GET", "/api/integrations/catalog"),
      ]);
      return ok({ catalog, integrations: integrations.map((i) => ({ ...i, status: i.status?.text })) });
    },
  );

  server.registerTool(
    "save_integration",
    {
      description: `Create or update an integration. Drivers and how each action is written:
- cli: {"kind":"cli","command":"jira issue list -a$(jira me) --plain --no-headers","output":"text"}; {{input}} placeholders are shell-quoted; {{secret:NAME}} reads the Keychain.
- http: {"kind":"http","method":"GET","url":"https://api.example.com/x?q={{query}}","headers":{"Authorization":"Bearer {{secret:EXAMPLE_TOKEN}}"},"output":"json","pick":"data.items"}; list secret names in "secrets" (the user sets their values in the app).
- claude: {"kind":"claude","tools":["mcp__claude_ai_Jira__search"],"how":"one line: which tool and how"}; set "mcpServer" to the connector's name as in \`claude mcp list\` (e.g. "claude.ai Atlassian").
- {"kind":"none"} for actions the service can't do.
Code-hosting list actions must return JSON in the documented shape and shouldn't be claude (they're polled every 5 minutes). Test read actions with run_integration_action after saving.`,
      inputSchema: {
        id: z.string().optional().describe("Existing id to update; omit to create"),
        name: z.string(),
        category: z.enum(["code", "issues", "messaging", "docs", "calendar", "ci"]),
        driver: z.enum(["builtin", "cli", "http", "claude"]),
        enabled: z.boolean().optional(),
        description: z.string().optional(),
        mcpServer: z.string().optional(),
        secrets: z.array(z.string()).optional(),
        actions: z.record(z.string(), z.any()).describe("actionId → implementation"),
      },
    },
    async (input) => {
      const body = { ...input, enabled: input.enabled ?? true };
      const saved = input.id
        ? await api("PUT", `/api/integrations/${encodeURIComponent(input.id)}`, body)
        : await api("POST", "/api/integrations", body);
      return ok({ ok: true, id: saved.id });
    },
  );
}
