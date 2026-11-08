// Claude runs the user starts: a scheduled kind now, a "Change…" on a card, learning their voice; and run logs.
import type { Hono } from "hono";
import { enqueue, runLog } from "../claude/runQueue.ts";
import { reviseJob, voiceJob } from "../claude/jobs.ts";
import { store } from "../store/store.ts";

export function registerRunRoutes(app: Hono) {
  app.post("/api/claude/run", async (c) => {
    const { kind = "manual" } = await c.req.json().catch(() => ({}));
    if (!["manual", "pulse", "wrapup", "morning"].includes(kind)) return c.json({ error: "bad kind" }, 400);
    return c.json({ queued: enqueue(kind, "you") });
  });
  app.get("/api/runs/:id/log", (c) => {
    const log = runLog(c.req.param("id"));
    return log === undefined ? c.json({ error: "no log" }, 404) : c.text(log);
  });

  // ---- "Change…": apply the user's correction to one card with a small, targeted run ----

  app.post("/api/revise", async (c) => {
    const { kind, id, instruction } = (await c.req.json()) as {
      kind: "message" | "todo";
      id: string;
      instruction: string;
    };
    if (!instruction?.trim()) return c.json({ error: "instruction required" }, 400);
    const day = store.today();
    const entity = kind === "message" ? day.messages.find((m) => m.id === id) : day.todos.find((t) => t.id === id);
    if (!entity) return c.json({ error: `${kind} not found` }, 404);
    return c.json({ queued: enqueue(reviseJob(kind, entity, instruction.trim()), "you") });
  });

  // ---- voice: how you write ----
  app.put("/api/voice", async (c) => c.json(store.setVoice(await c.req.json()))); // you editing the guide, or Claude's set_voice
  app.post("/api/voice/learn", (c) => c.json({ queued: enqueue(voiceJob("you")) }));
}
