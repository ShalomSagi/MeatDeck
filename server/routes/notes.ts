// Notes (docs in the UI). Claude writes Markdown; the editor stores its own JSON doc.
import type { Hono } from "hono";
import { appendMarkdown, markdownToDoc, normalizeTasks } from "../markdown.ts";
import { store } from "../store/store.ts";

export function registerNoteRoutes(app: Hono) {
  app.get("/api/notes/:id", (c) => c.json(store.note(c.req.param("id"))));
  app.post("/api/notes", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    // Claude (create_note) writes Markdown; the editor stores its own JSON doc.
    if (typeof body.markdown === "string") body.doc = markdownToDoc(body.markdown);
    if (body.doc) body.doc = normalizeTasks(body.doc);
    return c.json(store.createNote(body));
  });
  app.post("/api/notes/:id/append", async (c) => {
    const { markdown } = await c.req.json();
    const note = store.note(c.req.param("id"));
    const n = store.updateNote(note.id, { doc: appendMarkdown(note.doc, markdown ?? "") });
    return c.json({ ok: true, id: n.id, ref: n.ref, title: n.title });
  });

  app.patch("/api/notes/:id", async (c) => {
    const body = await c.req.json();
    if (typeof body.markdown === "string") body.doc = markdownToDoc(body.markdown); // Claude writes Markdown
    if (body.doc) body.doc = normalizeTasks(body.doc); // "1. [ ] …" lists → real checkboxes
    const n = store.updateNote(c.req.param("id"), body);
    return c.json({ id: n.id, ref: n.ref, updatedAt: n.updatedAt, doc: n.doc }); // doc comes back with checkbox ids assigned
  });
  app.delete("/api/notes/:id", (c) => {
    store.deleteNote(c.req.param("id"));
    return c.json({ ok: true });
  });
}
