// Drafted messages: draft, change, and send (only when the user asked).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ids, ok } from "../api.ts";

export function registerMessageTools(server: McpServer) {
  server.registerTool(
    "draft_messages",
    {
      description:
        "Draft messages the user should send to other humans (nudge a reviewer, answer a question, unblock someone). They appear in the dashboard as drafts for the user to edit/approve — never send anything yourself unless the user asks. Same `to` + `url` updates the existing draft.",
      inputSchema: {
        messages: z.array(
          z.object({
            to: z.string().describe("Person or channel display name"),
            channel: z.enum(["slack", "github", "linear", "email", "other"]).default("slack"),
            target: z.string().optional().describe("Slack user/channel id, PR url or issue id to send to"),
            threadTs: z.string().optional().describe("Slack thread ts if this is a thread reply"),
            text: z.string().describe("The message, in the user's voice: short, friendly, specific"),
            reason: z.string().describe("Why it's needed, with the evidence (e.g. 'waiting on re-review since Tue')"),
            url: z.string().optional(),
          }),
        ),
      },
    },
    async ({ messages }) => ids(await api("POST", "/api/messages", { messages })),
  );

  server.registerTool(
    "update_message",
    {
      description:
        "Change a drafted message: edit text, retarget it (to / channel / target / threadTs; threadTs null takes it out of a thread, e.g. to move it to a DM), update reason, or set status ('sent' after you sent an approved message on the user's request, or 'dismissed').",
      inputSchema: {
        id: z.string(),
        text: z.string().optional(),
        to: z.string().optional().describe("Display name of the new recipient"),
        channel: z.enum(["slack", "github", "linear", "email", "other"]).optional(),
        target: z.string().optional().describe("Slack user id (for a DM) or channel id, PR url, issue id"),
        threadTs: z.string().nullable().optional().describe("Thread ts, or null to post outside a thread"),
        reason: z.string().optional(),
        status: z.enum(["draft", "approved", "sent", "dismissed"]).optional(),
      },
    },
    async ({ id, ...patch }) => {
      await api("PATCH", `/api/messages/${id}`, { ...patch, by: "claude" });
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "send_messages",
    {
      description:
        "Send drafted messages (ids from get_dashboard / draft_messages) now, through each channel's integration. Only when the user asked to send. Optional edits: { [id]: final text }.",
      inputSchema: { ids: z.array(z.string()), edits: z.record(z.string(), z.string()).optional() },
    },
    async (body) => ok(await api("POST", "/api/messages/send", body)),
  );
}
