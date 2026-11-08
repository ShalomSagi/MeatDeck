// Projects, Claude's project suggestions, discovery runs and explicit links.
import type { Hono } from "hono";
import { projectJob } from "../claude/jobs.ts";
import { enqueue } from "../claude/runQueue.ts";
import { changes } from "../changes.ts";
import { store } from "../store/store.ts";

export function registerProjectRoutes(app: Hono) {
  app.get("/api/projects", (c) =>
    c.json(
      store.projects().map((p) => ({
        id: p.id,
        ref: p.ref,
        name: p.name,
        kind: p.kind,
        ignored: !!p.ignored,
        description: p.description?.slice(0, 200),
      })),
    ),
  );

  app.post("/api/projects", async (c) => {
    const { name, description = "", discover = true } = await c.req.json();
    if (!name?.trim()) return c.json({ error: "name required" }, 400);
    const project = store.createProject({ name, description });
    // A new project gets one Claude discovery pass; after that, code groups by the learned rules.
    if (discover) enqueue(projectJob(project.id), "you");
    return c.json(project);
  });
  app.patch("/api/projects/:id", async (c) => c.json(store.updateProject(c.req.param("id"), await c.req.json())));
  app.delete("/api/projects/:id", (c) => {
    store.deleteProject(c.req.param("id"));
    return c.json({ ok: true });
  });
  app.post("/api/suggestions", async (c) => {
    const r = store.addSuggestion(await c.req.json());
    if (r.ok) changes.emit("change");
    return c.json(r.ok ? { ok: true, id: r.suggestion.id, ref: r.suggestion.ref } : r, r.ok ? 200 : 422);
  });
  app.post("/api/suggestions/:id/accept", async (c) => {
    const p = store.acceptSuggestion(c.req.param("id"), await c.req.json().catch(() => ({})));
    changes.emit("change");
    return c.json(p);
  });
  app.post("/api/suggestions/:id/dismiss", (c) => {
    store.dismissSuggestion(c.req.param("id"));
    changes.emit("change");
    return c.json({ ok: true });
  });
  app.post("/api/projects/:id/discover", (c) => c.json({ queued: enqueue(projectJob(c.req.param("id")), "you") }));
  app.post("/api/projects/:id/links", async (c) => {
    const { keys, unlink = false } = await c.req.json();
    store.linkToProject(c.req.param("id"), keys, unlink);
    return c.json({ ok: true });
  });
}
