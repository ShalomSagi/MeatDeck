// stdio MCP server: lets any Claude Code session read and fill the dashboard.
// Talks to the local dashboard server over HTTP, so the UI updates live.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDashboardTools } from "./tools/dashboard.ts";
import { registerDocTools } from "./tools/docs.ts";
import { registerIntegrationTools } from "./tools/integrations.ts";
import { registerMessageTools } from "./tools/messages.ts";
import { registerPermissionTools } from "./tools/permissions.ts";
import { registerProjectTools } from "./tools/projects.ts";
import { registerQueueTools } from "./tools/queue.ts";
import { registerRuleTools } from "./tools/rules.ts";
import { registerSettingsTools } from "./tools/settings.ts";
import { registerTodoTools } from "./tools/todos.ts";

const server = new McpServer(
  { name: "meatdeck", version: "0.2.0" },
  {
    instructions:
      'MeatDeck is the user\'s local work dashboard (docs, projects, todos, drafted messages, tracked Linear/Slack items, rules, chats). Its items have short ids: N-12 = doc, P-3 = project, T-45 = todo, D-7 = draft message, I-9 = tracked item, R-2 = rule, C-5 = chat (sometimes written "meatdeck N-12"). When the user mentions one of these ids, or a MeatDeck doc (formerly "note") or project by name, call `lookup` (or `search` first if you only have words) and read it before answering. These ids refer to MeatDeck, not to Linear tickets (those look like ENG-123). When the user asks to save, note down or add something "in MeatDeck" (a doc, note, todo, checklist), write it there with create_doc / update_doc / append_to_doc / add_todos, not to a local file.',
  },
);

registerDashboardTools(server);
registerDocTools(server);
registerTodoTools(server);
registerMessageTools(server);
registerProjectTools(server);
registerQueueTools(server);
registerRuleTools(server);
registerSettingsTools(server);
registerIntegrationTools(server);
registerPermissionTools(server);

await server.connect(new StdioServerTransport());
