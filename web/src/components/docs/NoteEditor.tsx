/** Checkboxes carry a stable id so the matching todo in Today stays linked through edits and splits. */
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Plugin } from "@tiptap/pm/state";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckSquare,
  FileText,
  Folder,
  LoaderCircle,
  Pin,
  PinOff,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Note, NoteMeta, Project } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { RefChip } from "../RefChip.tsx";
import { DocIconPicker } from "./DocIconPicker.tsx";
import { Badge, Button } from "../ui.tsx";
import { agoText } from "../../lib.ts";

const TaskItemWithId = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-id"),
        renderHTML: (attrs: { id?: string | null }) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        appendTransaction: (trs, _old, state) => {
          if (!trs.some((t) => t.docChanged)) return null;
          const seen = new Set<string>();
          let tr = null as ReturnType<typeof state.tr.setNodeMarkup> | null;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "taskItem") return;
            let id = node.attrs.id as string | null;
            if (!id || seen.has(id)) {
              id = Math.random().toString(36).slice(2, 10);
              tr = (tr ?? state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, id });
            }
            seen.add(id);
          });
          return tr;
        },
      }),
    ];
  },
}).configure({ nested: true });

export function meetingTemplate(): JSONContent {
  const h = (text: string): JSONContent => ({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  });
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "With: " }] },
      h("Agenda"),
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      h("Notes"),
      { type: "paragraph" },
      h("Action items"),
      {
        type: "taskList",
        content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] }],
      },
    ],
  };
}

type SaveState = "saved" | "saving" | "dirty";

export function NoteEditor({
  noteId,
  meta,
  projects,
  onBack,
}: {
  noteId: string;
  meta?: NoteMeta;
  projects: Project[];
  onBack: () => void;
}) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const lastSaved = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: true, autolink: true } }),
      TaskList,
      TaskItemWithId,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading"
            ? "Heading"
            : "Write… “[ ]” starts an action item, “@tomorrow” gives it a due date",
      }),
    ],
    editorProps: { attributes: { class: "note-editor", spellcheck: "true" } },
    onUpdate: () => {
      setSave("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 600);
    },
  });

  const flush = async (patch: { title?: string } = {}) => {
    if (!editor) return;
    clearTimeout(timer.current);
    setSave("saving");
    const res = await api.updateNote(noteId, { ...patch, doc: editor.getJSON() });
    lastSaved.current = res.updatedAt;
    setSave("saved");
  };

  // Load the note (and reload when it changed elsewhere, e.g. a todo ticked in Today), unless you're typing.
  const load = async () => {
    const n = await api.getNote(noteId);
    setNote(n);
    setTitle(n.title);
    lastSaved.current = n.updatedAt;
    editor?.commands.setContent(n.doc as JSONContent, { emitUpdate: false });
  };
  useEffect(() => {
    setNote(null);
    if (editor) void load();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);
  useEffect(() => {
    if (!meta || !editor || save !== "saved") return;
    if (meta.updatedAt > lastSaved.current && !editor.isFocused) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.updatedAt]);

  // Save on unmount / note switch if there are pending edits.
  useEffect(
    () => () => {
      if (timer.current && editor && !editor.isDestroyed) void api.updateNote(noteId, { doc: editor.getJSON() });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteId, editor],
  );

  const projectNames = (meta?.projectIds ?? []).map((id) => projects.find((p) => p.id === id)?.name).filter(Boolean);

  return (
    <div className="group/doc mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Button size="xs" variant="ghost-muted" onClick={onBack}>
          <ArrowLeft /> Docs
        </Button>
        <span className="ml-auto flex items-center gap-1.5">
          {save === "saved" ? <Check className="size-3.5" /> : <LoaderCircle className="size-3.5 animate-spin" />}
          {save === "saved" ? (note ? `Saved · edited ${agoText(note.updatedAt)}` : "Loading…") : "Saving…"}
        </span>
        {note && (
          <>
            <Button
              size="icon-xs"
              variant="ghost-muted"
              title={note.pinned ? "Unpin" : "Pin to sidebar"}
              aria-label={note.pinned ? "Unpin" : "Pin"}
              onClick={async () => {
                await api.updateNote(noteId, { pinned: !note.pinned });
                setNote({ ...note, pinned: !note.pinned });
              }}
            >
              {note.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost-muted"
              title="Delete doc"
              aria-label="Delete doc"
              onClick={async () => {
                if (!confirm("Delete this doc? Its open action items are removed from Today.")) return;
                await api.deleteNote(noteId);
                onBack();
              }}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>

      {note && (
        <div className="mb-1">
          <DocIconPicker
            icon={note.icon}
            onChange={(icon) => {
              setNote({ ...note, icon: icon || undefined });
              void api.updateNote(noteId, { icon });
            }}
          />
        </div>
      )}
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setSave("dirty");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush({ title: e.target.value }), 600);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void flush({ title });
            editor?.commands.focus("start");
          }
        }}
        placeholder="Untitled"
        className="w-full bg-transparent text-3xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
      />

      <div className="mt-3 mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {note?.kind === "meeting" ? (
          <Badge variant="primary">
            <Users /> Meeting
          </Badge>
        ) : (
          <Badge>
            <FileText /> Doc
          </Badge>
        )}
        <RefChip id={note?.ref} />
        {note && (
          <span>
            {new Date(note.createdAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {meta && meta.openActions + meta.doneActions > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3.5" /> {meta.doneActions}/{meta.openActions + meta.doneActions} actions done
          </span>
        )}
        {projectNames.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 text-foreground/75">
            <Folder className="size-3.5 text-muted-foreground" />
            {name}
          </span>
        ))}
      </div>

      <EditorContent editor={editor} />

      <p className="mt-10 flex items-center gap-1.5 border-t border-border pt-3 text-2xs text-muted-foreground/80">
        <CalendarClock className="size-3.5" />
        <span>
          <code className="font-mono">[ ]</code> action item, which shows up in Today ·{" "}
          <code className="font-mono">@today</code> <code className="font-mono">@tomorrow</code>{" "}
          <code className="font-mono">@fri</code> <code className="font-mono">@12/11</code> due date ·{" "}
          <code className="font-mono">#</code> heading · <code className="font-mono">-</code> list. Claude reads new
          docs on its next run and follows up.
        </span>
      </p>
    </div>
  );
}
