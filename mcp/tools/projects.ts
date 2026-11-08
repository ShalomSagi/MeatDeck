// Projects: teach them matching rules and context, create, suggest (the user decides), delete, link.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ok } from "../api.ts";

const ruleLists = z
  .object({
    repos: z
      .array(z.string())
      .optional()
      .describe('"owner/name". Only for repos dedicated to this project: every PR there will match.'),
    linearProjects: z.array(z.string()).optional(),
    linearIssues: z
      .array(z.string())
      .optional()
      .describe("Ticket keys like ENG-142: matches the ticket and any PR/todo/thread mentioning it"),
    slackChannels: z.array(z.string()).optional().describe("Channel names without #"),
    keywords: z
      .array(z.string())
      .optional()
      .describe("Distinctive phrases (3+ chars) matched in titles. Avoid generic words."),
  })
  .optional();

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    "update_project",
    {
      description:
        "Teach a project how to recognise its work, and record where it stands. Prefer RULES over links: code applies rules to every future PR, ticket and thread for free, so a good rule saves tokens forever. addRules merges; removeRules deletes a rule that over-matches. `context` replaces the project's short status summary (status, key people, blockers, next milestone; under ~120 words).",
      inputSchema: {
        id: z.string(),
        addRules: ruleLists,
        removeRules: ruleLists,
        context: z.string().optional(),
        name: z.string().optional().describe("Rename (manual projects)"),
        description: z
          .string()
          .optional()
          .describe(
            "What the project is. Manual projects: set freely. Linear projects: only when copying Linear's description (set fromLinear: true).",
          ),
        hidden: z
          .boolean()
          .optional()
          .describe("true hides the project everywhere and stops spending tokens on it; false shows it again"),
        priority: z
          .number()
          .int()
          .min(0)
          .max(4)
          .nullable()
          .optional()
          .describe(
            "The user's MeatDeck priority: 1 urgent, 2 high, 3 medium, 4 low, 0 none. Overrides Linear's. null = follow Linear again. Only when the user asks.",
          ),
        linearPriority: z
          .number()
          .int()
          .min(0)
          .max(4)
          .optional()
          .describe("Linear sync only (with fromLinear: true): the project's priority in Linear"),
        url: z.string().optional(),
        fromLinear: z.boolean().optional(),
      },
    },
    async ({ id, hidden, ...patch }) => {
      await api("PATCH", `/api/projects/${id}`, { ...patch, ...(hidden === undefined ? {} : { ignored: hidden }) });
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "list_projects",
    { description: "List MeatDeck projects (id, ref like P-3, name, kind manual/linear, hidden).", inputSchema: {} },
    async () => ok(await api("GET", "/api/projects")),
  );

  server.registerTool(
    "create_project",
    {
      description:
        "Create a MeatDeck project (a conceptual piece of work: a migration, a launch, an initiative). Give it a description of what it is. Then teach it what belongs to it with update_project addRules (ticket keys, repos, channels, keywords) from what you already know: that's free. Set discover: true only if you know nothing and want a separate Claude run to search Slack/Linear/GitHub for it (costs tokens). Returns id and ref.",
      inputSchema: { name: z.string(), description: z.string().optional(), discover: z.boolean().optional() },
    },
    async ({ name, description, discover }) => {
      const p = await api("POST", "/api/projects", {
        name,
        description: description ?? "",
        discover: discover ?? false,
      });
      return ok({ ok: true, id: p.id, ref: p.ref });
    },
  );

  server.registerTool(
    "suggest_project",
    {
      description:
        "Propose a new MeatDeck project for ACTIVE work the user is doing that no existing project covers. The user accepts or dismisses it; nothing is created until they do. MeatDeck is for managing active work only, so suggest only when you see the user actually doing the work: PRs they opened or review, Linear tickets in progress or assigned to them, a thread where they and colleagues coordinate concrete next steps, owners or dates. NEVER for ideas, brainstorms, 'we should…', 'maybe…', wishlists, someone else's project the user only watches, or a one-off task (that's a todo). Needs at least 2 independent pieces of evidence (with links). If it fits an existing project, teach that project instead (update_project). Rarely more than 1 per run. Returns ok, or the reason it was refused (then don't retry).",
      inputSchema: {
        name: z.string().describe("Short project name, e.g. 'Dashboard Vite migration'"),
        description: z.string().describe("What the work is, 1-2 sentences, in plain words"),
        why: z
          .string()
          .describe(
            "One line the user reads: the active-work signal, e.g. 'You opened 2 PRs and agreed a Thursday cutover with Alex in #app'",
          ),
        evidence: z
          .array(z.object({ text: z.string(), url: z.string().optional() }))
          .min(2)
          .describe("Concrete signals, each with a link when there is one"),
        rules: ruleLists.describe(
          "How code should recognise its work once accepted: ticket keys, channels, distinctive keywords, dedicated repos",
        ),
        keys: z.array(z.string()).optional().describe("Specific PR urls / item ids to attach on accept"),
      },
    },
    async (input) =>
      ok(
        await api("POST", "/api/suggestions", input).catch((e: Error) => {
          const body = e.message.replace(/^\d+: /, "");
          try {
            return JSON.parse(body);
          } catch {
            return { ok: false, reason: body };
          }
        }),
      ),
  );

  server.registerTool(
    "delete_project",
    {
      description:
        "Delete a MeatDeck project (its work stays; it just isn't grouped). To only hide it, use update_project hidden: true.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      await api("DELETE", `/api/projects/${id}`);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "link_to_project",
    {
      description:
        "Attach specific things no rule can catch (keys: PR url, item id, or todo:<id>). Use sparingly; a rule (ticket key, keyword) is better when one exists. unlink=true removes a wrong match.",
      inputSchema: { projectId: z.string(), keys: z.array(z.string()), unlink: z.boolean().optional() },
    },
    async ({ projectId, ...body }) => {
      await api("POST", `/api/projects/${projectId}/links`, body);
      return ok({ ok: true });
    },
  );
}
