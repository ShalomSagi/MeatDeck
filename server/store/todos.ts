// Todos: today's list. Auto todos from code, Claude's, yours, and those synced from doc checkboxes.
import type { Todo } from "../../shared/types.ts";
import { renderText, setTaskChecked } from "../notes.ts";
import { newId, NotFound, now, stripUndefined } from "./helpers.ts";
import type { Store } from "./store.ts";

export function addTodos(
  s: Store,
  inputs: (Partial<Todo> & { title: string })[],
  createdBy: Todo["createdBy"],
): Todo[] {
  const day = s.today();
  const added: Todo[] = [];
  for (const input of inputs) {
    // Auto todos never touch an existing one: an open todo for that PR already covers it.
    if (createdBy === "auto" && input.url && day.todos.some((t) => t.url === input.url && t.status === "open"))
      continue;
    // De-dupe by url or title so repeated morning runs don't pile up copies.
    const existing =
      createdBy === "auto"
        ? undefined
        : day.todos.find(
            (t) => (input.url && t.url === input.url) || t.title.toLowerCase() === input.title.toLowerCase(),
          );
    if (existing) {
      Object.assign(existing, stripUndefined({ ...input, id: existing.id, status: existing.status }));
      added.push(existing);
      continue;
    }
    const todo: Todo = {
      ref: s.nextRef("T"),
      source: "manual",
      priority: "p1",
      ...stripUndefined(input),
      id: newId(),
      status: "open",
      createdBy,
      createdAt: now(),
    };
    day.todos.push(todo);
    added.push(todo);
  }
  s.save();
  return added;
}

export function updateTodo(s: Store, todoId: string, patch: Partial<Todo>): Todo {
  const todo = s.today().todos.find((t) => t.id === todoId);
  if (!todo) throw new NotFound(`todo ${todoId}`);
  Object.assign(todo, stripUndefined(patch), { id: todo.id });
  if (patch.status === "done") todo.doneAt = now();
  if (patch.status === "open") delete todo.doneAt;
  // Ticking a note's todo ticks the checkbox in the note too.
  if (patch.status && todo.noteId && todo.noteItemId) {
    const note = s.notes().find((n) => n.id === todo.noteId);
    if (note && setTaskChecked(note.doc, todo.noteItemId, patch.status === "done")) {
      note.text = renderText(note.doc);
      note.updatedAt = now();
    }
  }
  s.save();
  return todo;
}

export function removeTodo(s: Store, todoId: string) {
  const day = s.today();
  day.todos = day.todos.filter((t) => t.id !== todoId);
  s.save();
}

export function reorderTodos(s: Store, ids: string[]) {
  const day = s.today();
  const rank = new Map(ids.map((v, i) => [v, i]));
  day.todos.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  s.save();
}
