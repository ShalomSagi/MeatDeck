// Rules: standing instructions every Claude run follows, and learned preferences (instruction rules).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Rule } from "../../shared/types.ts";
import { api, ok } from "../api.ts";

export function registerRuleTools(server: McpServer) {
  server.registerTool(
    "list_rules",
    {
      description: "List the user's standing rules (instructions every run follows, and CI checks to ignore).",
      inputSchema: {},
    },
    async () => {
      const rules: Rule[] = await api("GET", "/api/rules");
      return ok(
        rules.map((r) => ({
          id: r.id,
          kind: r.kind,
          text: r.text,
          pattern: r.pattern,
          enabled: r.enabled,
          by: r.by,
        })),
      );
    },
  );

  server.registerTool(
    "add_rule",
    {
      description:
        "Save a standing rule the user asked for ('always…', 'never…', 'ignore…'). kind 'ignore_check': CI checks whose name matches `pattern` (case-insensitive substring, * wildcard, e.g. 'sonar') never count as failing; code enforces it immediately, so no 'Fix CI' items get created for them. kind 'instruction': any other rule, phrased as a short imperative, which every Claude run will follow. Re-adding the same rule updates it.",
      inputSchema: {
        kind: z.enum(["instruction", "ignore_check"]),
        text: z.string().describe("The rule in plain words, e.g. 'Ignore SonarQube checks: they're allowed to fail'"),
        pattern: z.string().optional().describe("ignore_check only: check-name pattern, e.g. 'sonar'"),
      },
    },
    async (input) => {
      const rule = await api("POST", "/api/rules", { ...input, by: "chat" });
      return ok({ ok: true, id: rule.id });
    },
  );

  server.registerTool(
    "update_rule",
    {
      description: "Edit a rule (text, pattern) or turn it on/off. Get ids from list_rules.",
      inputSchema: {
        id: z.string(),
        text: z.string().optional(),
        pattern: z.string().optional(),
        enabled: z.boolean().optional(),
      },
    },
    async ({ id, ...patch }) => {
      await api("PATCH", `/api/rules/${id}`, patch);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "delete_rule",
    { description: "Delete a rule. Get ids from list_rules.", inputSchema: { id: z.string() } },
    async ({ id }) => {
      await api("DELETE", `/api/rules/${id}`);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "remember_preference",
    {
      description:
        "Save one short, general rule learned from the user's correction, so every future run follows it (it appears in the digest as `preferences`). Only for habits that will recur, never one-off details. Example: 'If a channel thread continued in DM, follow up in that DM, not the channel.'",
      inputSchema: { text: z.string(), from: z.string().optional().describe("The correction it came from") },
    },
    async (input) => {
      await api("POST", "/api/preferences", input);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "list_preferences",
    {
      description:
        "What MeatDeck has learned from the user's corrections (remember_preference). Use with forget_preference.",
      inputSchema: {},
    },
    async () => ok(await api("GET", "/api/preferences")),
  );

  server.registerTool(
    "forget_preference",
    { description: "Delete a learned preference (id from list_preferences).", inputSchema: { id: z.string() } },
    async ({ id }) => {
      await api("DELETE", `/api/preferences/${id}`);
      return ok({ ok: true });
    },
  );
}
