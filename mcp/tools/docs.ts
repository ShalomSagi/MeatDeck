// Docs (stored as notes): create, replace, append to and read them as Markdown/plain text.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ok } from "../api.ts";

export function registerDocTools(server: McpServer) {
  server.registerTool(
    "create_doc",
    {
      description:
        "Create a MeatDeck doc: the default place for anything the user wants written down (a doc, document, note, list, plan, checklist), unless they name another tool. icon: one emoji that fits the doc (Notion-style page icon), e.g. 🚀 for a launch plan, 🧪 for a test plan. Markdown: # headings, - bullets, 1. numbered lists, **bold**, `code`, links. CHECKBOXES: write each todo as its own line starting with '- [ ] ' (dash, space, brackets with a space, space), e.g. '- [ ] Fix the failing tests @tomorrow'; '- [x] ' for done ones. Never number them ('1. [ ]') and never put '[ ]' inside a bullet or numbered item's text: for an ordered checklist, keep the '- [ ]' lines in order (a heading like 'Steps, in order' is enough). Each '- [ ]' line becomes a checkbox in the note and a todo in Today; due dates come from @today/@tomorrow/@fri/@2026-11-12 at the end of the line. Returns the note id.",
      inputSchema: {
        title: z.string(),
        markdown: z.string(),
        kind: z.enum(["note", "meeting"]).optional().describe("'meeting' for meeting notes, else omit"),
        icon: z.string().optional().describe("One emoji, the doc's icon"),
      },
    },
    async (input) => {
      const n = await api("POST", "/api/notes", input);
      return ok({ ok: true, id: n.id, ref: n.ref }); // tell the user the ref (N-12), not the internal id
    },
  );

  server.registerTool(
    "update_doc",
    {
      description:
        'Replace a MeatDeck doc\'s content (and/or title, icon) with Markdown. Use it to fill or rewrite the doc the user is looking at ("add this to the doc as a todo list", "rewrite this doc"). icon: one emoji, or "" to remove it. Same Markdown rules as create_doc: todos/checkboxes are \'- [ ] text\' lines, never \'1. [ ]\'. To add to the end without replacing, use append_to_doc.',
      inputSchema: {
        id: z.string().describe("Doc id (or N-12 style ref via lookup)"),
        title: z.string().optional(),
        markdown: z.string().optional(),
        icon: z.string().optional(),
      },
    },
    async ({ id, title, markdown, icon }) => {
      const r = await api("PATCH", `/api/notes/${id}`, {
        ...(title !== undefined ? { title } : {}),
        ...(markdown !== undefined ? { markdown } : {}),
        ...(icon !== undefined ? { icon } : {}),
      });
      return ok({ ok: true, id: r.id, ref: r.ref });
    },
  );

  server.registerTool(
    "append_to_doc",
    {
      description:
        "Append Markdown to the end of an existing MeatDeck doc (same Markdown rules as create_doc: todos/checkboxes are '- [ ] text' lines, never '1. [ ]').",
      inputSchema: { id: z.string(), markdown: z.string() },
    },
    async ({ id, markdown }) => ok(await api("POST", `/api/notes/${id}/append`, { markdown })),
  );

  server.registerTool(
    "get_doc",
    {
      description:
        "Full plain text of one doc (headings #, bullets -, checkboxes [ ]/[x]). The digest already includes docs edited since the last run; use this only for an older doc you need.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const n = await api("GET", `/api/notes/${id}`);
      return ok({ id: n.id, title: n.title, kind: n.kind, updatedAt: n.updatedAt, text: n.text });
    },
  );
}
