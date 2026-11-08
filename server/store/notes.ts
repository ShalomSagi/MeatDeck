// Notes (docs in the UI): the editor's JSON doc plus its plain text; checkboxes become todos.
import type { Note } from "../../shared/types.ts";
import { extractTasks, renderText } from "../notes.ts";
import { localDate, newId, NotFound, now } from "./helpers.ts";
import type { Store } from "./store.ts";

export function notes(s: Store): Note[] {
  return (s.data.notes ??= []);
}

export function getNote(s: Store, noteId: string): Note {
  const n = s.notes().find((x) => x.id === noteId);
  if (!n) throw new NotFound(`note ${noteId}`);
  return n;
}

export function createNote(
  s: Store,
  input: { title?: string; kind?: Note["kind"]; doc?: unknown; icon?: string },
): Note {
  const doc = input.doc ?? { type: "doc", content: [{ type: "paragraph" }] };
  const n: Note = {
    ref: s.nextRef("N"),
    id: newId(),
    title: input.title?.trim() || "",
    kind: input.kind ?? "note",
    ...(input.icon?.trim() ? { icon: input.icon.trim() } : {}),
    doc,
    text: renderText(doc),
    createdAt: now(),
    updatedAt: now(),
  };
  s.notes().unshift(n);
  syncNoteTodos(s, n);
  s.save();
  return n;
}

export function updateNote(
  s: Store,
  noteId: string,
  patch: Partial<Pick<Note, "title" | "doc" | "pinned" | "kind" | "icon">>,
): Note {
  const n = s.note(noteId);
  // "" or null clears the icon.
  if (patch.icon !== undefined) {
    if (patch.icon?.trim()) n.icon = patch.icon.trim();
    else delete n.icon;
  }
  if (patch.title !== undefined) n.title = patch.title;
  if (patch.pinned !== undefined) n.pinned = patch.pinned;
  if (patch.kind !== undefined) n.kind = patch.kind;
  if (patch.doc !== undefined) {
    n.doc = patch.doc;
    n.text = renderText(n.doc);
  }
  n.updatedAt = now();
  syncNoteTodos(s, n);
  s.save();
  return n;
}

export function deleteNote(s: Store, noteId: string) {
  const day = s.today();
  day.todos = day.todos.filter((t) => t.noteId !== noteId || t.status !== "open");
  s.data.notes = s.notes().filter((n) => n.id !== noteId);
  s.save();
}

/** Checkboxes → todos (plain code). The note is the source of truth for text, due date and checked state. */
function syncNoteTodos(s: Store, note: Note) {
  const day = s.today();
  const tasks = extractTasks(note.doc);
  const ids = new Set(tasks.map((t) => t.id));
  const today = localDate();
  for (const task of tasks) {
    const existing = day.todos.find((t) => t.noteId === note.id && t.noteItemId === task.id);
    const priority = task.due && task.due <= today ? "p0" : "p1";
    if (existing) {
      existing.title = task.text;
      existing.due = task.due;
      existing.priority = priority;
      if (task.checked && existing.status !== "done") {
        existing.status = "done";
        existing.doneAt = now();
      } else if (!task.checked && existing.status === "done") {
        existing.status = "open";
        delete existing.doneAt;
      }
    } else if (!task.checked) {
      day.todos.push({
        ref: s.nextRef("T"),
        id: newId(),
        title: task.text,
        source: "manual",
        priority,
        status: "open",
        createdBy: "me",
        noteId: note.id,
        noteItemId: task.id,
        due: task.due,
        createdAt: now(),
      });
    }
  }
  // Checkbox deleted from the note → its open todo goes too.
  day.todos = day.todos.filter(
    (t) => t.noteId !== note.id || !t.noteItemId || ids.has(t.noteItemId) || t.status !== "open",
  );
}
