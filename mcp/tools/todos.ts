// Todos and tracked items (Linear issues, Slack threads…), and deleting either for good.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ids, ok } from "../api.ts";

const source = z.enum(["github", "linear", "slack", "calendar", "notion", "manual", "other"]);

export function registerTodoTools(server: McpServer) {
  server.registerTool(
    "add_todos",
    {
      description:
        "Add todos for today. Re-adding a todo with the same url or title updates it instead of duplicating, so it's safe to re-run. Unfinished todos from yesterday are already carried over automatically — check get_dashboard before adding.",
      inputSchema: {
        todos: z.array(
          z.object({
            title: z.string().describe("Imperative and specific: 'Address Alex's comments on PR #812'"),
            notes: z.string().optional(),
            source: source.optional(),
            url: z.string().optional(),
            priority: z.enum(["p0", "p1", "p2"]).optional().describe("p0 = must happen today / unblocks others"),
            itemId: z.string().optional().describe("OpenItem id this moves forward"),
            noteId: z.string().optional().describe("Doc this action came from (implicit actions you found in a doc)"),
            due: z.string().optional().describe("YYYY-MM-DD when it must be done"),
          }),
        ),
      },
    },
    async ({ todos }) => ids(await api("POST", "/api/todos", { todos, createdBy: "claude" })),
  );

  server.registerTool(
    "update_todo",
    {
      description: "Update a todo: mark it done/skipped/open, retitle, reprioritise, set a due date.",
      inputSchema: {
        id: z.string(),
        status: z.enum(["open", "done", "skipped"]).optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
        priority: z.enum(["p0", "p1", "p2"]).optional(),
        due: z.string().optional().describe("YYYY-MM-DD"),
      },
    },
    async ({ id, ...patch }) => {
      await api("PATCH", `/api/todos/${id}`, patch);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "upsert_items",
    {
      description:
        "Track where each piece of work stands (Linear issues, Slack threads, PRs that need context beyond the live GitHub panel). Items are keyed by a stable id like 'linear:ENG-123' or 'slack:C0123/1712345.678'. Pass replaceSource to make the list for that source exactly what you send (items you omit are removed). Set state 'done' to remove one.",
      inputSchema: {
        replaceSource: source.optional(),
        items: z.array(
          z.object({
            id: z.string(),
            source,
            kind: z.enum(["pr", "review", "issue", "thread", "meeting", "other"]),
            title: z.string(),
            url: z.string().optional(),
            state: z.enum(["needs_me", "waiting", "blocked", "in_progress", "done"]),
            status: z.string().optional().describe("Short status line, e.g. 'In Review · 2 comments'"),
            waitingOn: z.string().optional(),
            project: z
              .string()
              .optional()
              .describe("Linear project name (Linear items) or Slack channel name (Slack items). Not a repo."),
            repo: z.string().optional().describe('GitHub repo "owner/name" if the item lives in code'),
            note: z.string().optional(),
            updatedAt: z.string().optional().describe("ISO time of the last real activity"),
          }),
        ),
      },
    },
    async (input) => ok(await api("POST", "/api/items", input)),
  );

  server.registerTool(
    "delete",
    {
      description:
        "Delete a doc, todo or tracked item for good (to just finish a todo, use update_todo status done). Use the internal id, or a ref like N-12 / T-45 / I-9.",
      inputSchema: {
        kind: z.enum(["doc", "note", "todo", "item"]).describe("doc (also accepts note), todo or item"),
        id: z.string(),
      },
    },
    async ({ kind, id }) => {
      let realId = id;
      if (/^[A-Z]-\d+$/i.test(id)) realId = (await api("GET", `/api/lookup/${encodeURIComponent(id)}`)).id ?? id;
      await api(
        "DELETE",
        `/api/${kind === "note" || kind === "doc" ? "notes" : kind === "todo" ? "todos" : "items"}/${realId}`,
      );
      return ok({ ok: true });
    },
  );
}
