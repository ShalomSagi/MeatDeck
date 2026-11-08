// Todos and tracked items.
import type { Hono } from "hono";
import { itemEntity, itemRepo, matchProjects, projectsOfTodo, repoOfUrl } from "../../shared/projects.ts";
import type { OpenItem, Todo } from "../../shared/types.ts";
import { store } from "../store/store.ts";
import { entityIndex, hidden, isHomework } from "./writeFilters.ts";

export function registerTodoRoutes(app: Hono) {
  app.post("/api/todos", async (c) => {
    const body = await c.req.json();
    const createdBy = body.createdBy === "claude" ? "claude" : "me";
    const incoming: Todo[] = body.todos ?? [body];
    if (createdBy === "claude") {
      const homework = incoming.filter((t) => isHomework(t.title));
      if (homework.length)
        return c.json(
          {
            error: `Not added. These ask the user to check something: ${homework.map((t) => JSON.stringify(t.title)).join(", ")}. Do the check yourself (gh pr view, Slack, Linear), then add the conclusion as the todo: the concrete next step ("Nudge Alex in #code-reviews to review app#1475"), or nothing if there's nothing to do. If you truly can't reach the source, state what you know as fact and the one step that follows from it.`,
          },
          422,
        );
    }
    const todos = incoming.filter((t: Todo) => !hidden(repoOfUrl(t.url), projectsOfTodo(t, entityIndex())));
    return c.json(store.addTodos(todos, createdBy));
  });
  app.post("/api/todos/reorder", async (c) => {
    store.reorderTodos((await c.req.json()).ids);
    return c.json({ ok: true });
  });
  app.patch("/api/todos/:id", async (c) => c.json(store.updateTodo(c.req.param("id"), await c.req.json())));
  app.delete("/api/todos/:id", (c) => {
    store.removeTodo(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/items", async (c) => {
    const body = await c.req.json();
    const items = (body.items ?? [body]).filter(
      (i: OpenItem) => !hidden(itemRepo(i), matchProjects(itemEntity(i), store.projects(), store.links())),
    );
    return c.json({ upserted: store.upsertItems(items, body.replaceSource) });
  });
  app.delete("/api/items/:id", (c) => {
    store.removeItem(c.req.param("id"));
    return c.json({ ok: true });
  });
}
