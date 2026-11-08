// Permissions: Claude Code calls approve_permission (--permission-prompt-tool) for tools outside a
// run's allowlist; it asks the user in the app and waits for the answer.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, ok } from "../api.ts";

export function registerPermissionTools(server: McpServer) {
  server.registerTool(
    "approve_permission",
    {
      description:
        "Internal: asks the user in the MeatDeck app whether this run may use a tool, and waits for the answer.",
      inputSchema: { tool_name: z.string(), input: z.any(), tool_use_id: z.string().optional() },
    },
    async ({ tool_name, input }) => {
      const deny = (message: string) => ok({ behavior: "deny", message });
      let id: string;
      try {
        ({ id } = await api("POST", "/api/permissions", {
          tool: tool_name,
          input,
          chatId: process.env.MEATDECK_CHAT,
          run: process.env.MEATDECK_RUN,
        }));
      } catch {
        return deny("Couldn't reach the MeatDeck app to ask the user.");
      }
      // Wait for the user (up to 15 minutes), polling: one long request would hit fetch timeouts.
      const until = Date.now() + 15 * 60_000;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 1200));
        const res = await api("GET", `/api/permissions/${id}`).catch(() => null);
        if (!res || res.status === "pending") continue;
        return res.status === "allow"
          ? ok({ behavior: "allow", updatedInput: input })
          : deny(res.message ?? "The user declined.");
      }
      await api("POST", `/api/permissions/${id}/expire`, {}).catch(() => {});
      return deny("Nobody answered the permission request in time.");
    },
  );
}
