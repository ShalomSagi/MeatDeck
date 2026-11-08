// Drafted messages, and sending the ones the user picked.
import type { Hono } from "hono";
import { projectsOfMessage, repoOfUrl } from "../../shared/projects.ts";
import type { Message } from "../../shared/types.ts";
import { sendMessages } from "../claude/runQueue.ts";
import { watchClosely } from "../githubPolling.ts";
import { runAction, senderFor } from "../integrations.ts";
import { store } from "../store/store.ts";
import { entityIndex, hidden } from "./writeFilters.ts";

export function registerMessageRoutes(app: Hono) {
  app.post("/api/messages", async (c) => {
    const body = await c.req.json();
    return c.json(
      store.addMessages(
        (body.messages ?? [body]).filter(
          (m: Message) => !hidden(repoOfUrl(m.url), projectsOfMessage(m, entityIndex())),
        ),
      ),
    );
  });
  app.patch("/api/messages/:id", async (c) => {
    const { by, ...patch } = await c.req.json();
    return c.json(store.updateMessage(c.req.param("id"), patch, by === "claude" ? "claude" : "me"));
  });

  // Send = the user clicked Send on specific messages. Claude sends them verbatim.
  app.post("/api/messages/send", async (c) => {
    const { ids, edits = {} } = (await c.req.json()) as { ids: string[]; edits?: Record<string, string> };
    const day = store.today();
    const picked = day.messages
      .filter((m) => ids.includes(m.id) && m.status !== "sent")
      .map((m) => ({ ...m, text: edits[m.id] ?? m.text }));
    if (!picked.length) return c.json({ error: "nothing to send" }, 400);
    // Each draft goes out through the integration for its channel. Built-in, CLI and API integrations
    // send directly (no tokens); Claude-driver ones (e.g. Slack via the connector) go in one Claude run.
    const viaClaude = [];
    const results: Record<string, string> = {};
    for (const m of picked) {
      const route = senderFor(m.channel);
      if (!route) {
        results[m.id] = `No enabled integration can send on ${m.channel}`;
        continue;
      }
      if (route.integration.actions[route.action].kind === "claude") {
        viaClaude.push(m);
        continue;
      }
      const input: Record<string, string> =
        route.action === "commentOnPullRequest"
          ? { url: m.url ?? m.target ?? "", body: m.text }
          : route.action === "commentOnIssue"
            ? { id: m.target ?? m.url ?? "", body: m.text }
            : { target: m.target ?? "", text: m.text, thread: m.threadTs ?? "" };
      const r = await runAction(route.integration.id, route.action, input);
      if (r.ok) store.updateMessage(m.id, { status: "sent", text: m.text });
      results[m.id] = r.ok ? "sent" : `failed: ${r.error}`;
    }
    watchClosely(); // a nudge often gets an approval within minutes
    return c.json({ results, queued: viaClaude.length ? sendMessages(viaClaude) : false });
  });
}
