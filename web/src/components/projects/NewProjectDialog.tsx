import { Folder, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Project } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { Button } from "../ui.tsx";

export function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      onCreated(await api.createProject(name, description));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="w-full max-w-lg rounded-xl border border-border bg-popover p-4 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">New project</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Mobile → core migration"
          className="mt-3 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20 dark:bg-input/32"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe it in plain words: what it is, codenames, ticket prefixes, who's involved, related repos or channels."
          className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-5 outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20 dark:bg-input/32"
        />
        <p className="mt-2 flex gap-2 text-2xs leading-4 text-muted-foreground">
          Claude runs one discovery pass to find related Linear tickets, PRs and Slack threads. It saves what it learns
          as matching rules (ticket keys, channels, keywords), so from then on code groups new work into the project for
          free.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost-muted" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="default" type="submit" disabled={!name.trim() || busy}>
            {busy && <LoaderCircle className="animate-spin" />} Create & discover
          </Button>
        </div>
      </form>
    </div>
  );
}
