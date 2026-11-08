// The prompt box, docked under every page (T3 Code style). It attaches the page you're on as a
// removable chip, supports @-mentions (notes, projects, repos) and /commands, and has a model picker.
import {
  ArrowUp,
  FileText,
  Folder,
  FolderGit2,
  ListTodo,
  MessageSquareText,
  Search,
  Square,
  Sunrise,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { repoShort } from "../../../../shared/projects.ts";
import type { ModelSelection } from "../../../../shared/providers.ts";
import type { ContextRef, DashboardState } from "../../../../shared/types.ts";
import { ModelPicker } from "./ModelPicker.tsx";
import { refKey, refLabel } from "./contextRefs.tsx";
import { DocIcon } from "../docs/DocIcon.tsx";
import { cn } from "../ui.tsx";

const COMMANDS = [
  { cmd: "doc", label: "Create a doc", hint: "/doc from the cutover discussion in Notion", icon: <FileText /> },
  { cmd: "todo", label: "Add todos", hint: "/todo ask infra about quotas by Thursday", icon: <ListTodo /> },
  { cmd: "draft", label: "Draft a message", hint: "/draft ping Dana to re-review #812", icon: <MessageSquareText /> },
  { cmd: "summarize", label: "Summarize", hint: "/summarize this project", icon: <FileText /> },
  { cmd: "search", label: "Search everywhere", hint: "/search mobile cutover plan", icon: <Search /> },
];

interface Mentionable {
  ref: ContextRef;
  label: string;
  icon: ReactNode;
  kind: string;
}

export function Composer({
  state,
  pageRef,
  selection,
  onSelect,
  busy,
  onSend,
  onStop,
  focusSignal,
  compact,
  onMenuChange,
  attach,
}: {
  /** Something to attach from outside ("Chat about this" on a queue row); `n` changes each time. */
  attach?: { ref: ContextRef; n: number } | null;
  state: DashboardState;
  /** The page you're on; attached by default, removable. */
  pageRef: ContextRef | null;
  selection: ModelSelection;
  onSelect: (s: ModelSelection) => void;
  busy: boolean;
  onSend: (text: string, refs: ContextRef[]) => void;
  onStop: () => void;
  focusSignal: number;
  compact?: boolean;
  /** Tells the page a menu is open, so it can dim and blur what's behind. */
  onMenuChange?: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ContextRef[]>([]);
  const [pageOff, setPageOff] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [modelOpen, setModelOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // A new page re-attaches itself.
  const pageKey = pageRef && refKey(pageRef);
  const [lastPageKey, setLastPageKey] = useState(pageKey);
  if (pageKey !== lastPageKey) {
    setLastPageKey(pageKey);
    setPageOff(false);
  }
  useEffect(() => {
    if (focusSignal) area.current?.focus();
  }, [focusSignal]);
  const attachN = attach?.n;
  const [attachedN, setAttachedN] = useState<number | undefined>();
  if (attach && attach.n !== attachedN) {
    setAttachedN(attach.n);
    setMentions((cur) => [
      ...cur.filter((r) => refKey(r) !== refKey(attach.ref) && r.type !== "action" && r.type !== "draft"),
      attach.ref,
    ]);
  }
  useEffect(() => {
    if (attachN) area.current?.focus();
  }, [attachN]);

  const refs = useMemo(() => {
    const out: ContextRef[] = [];
    if (pageRef && !pageOff) out.push(pageRef);
    for (const m of mentions) if (!out.some((r) => refKey(r) === refKey(m))) out.push(m);
    return out;
  }, [pageRef, pageOff, mentions]);

  // "@query" at the caret → mention menu; "/cmd" at the start → command menu.
  const caretWord = useMemo(() => {
    const m = /(^|\s)@([^\s@]*)$/.exec(text);
    return m ? m[2] : null;
  }, [text]);
  const slash = /^\/(\w*)$/.exec(text)?.[1];

  const mentionables: Mentionable[] = useMemo(() => {
    const repos = [...new Set([...state.github.mine, ...state.github.reviewRequests].map((p) => p.repo))];
    return [
      { ref: { type: "today" } as ContextRef, label: "Today", icon: <Sunrise />, kind: "page" },
      ...state.projects
        .filter((p) => !p.ignored)
        .map((p) => ({
          ref: { type: "project", id: p.id } as ContextRef,
          label: p.name,
          icon: <Folder />,
          kind: "project",
        })),
      ...state.notes.map((n) => ({
        ref: { type: "note", id: n.id } as ContextRef,
        label: n.title || "Untitled",
        icon: <DocIcon icon={n.icon} kind={n.kind} />,
        kind: "doc",
      })),
      ...repos.map((r) => ({
        ref: { type: "repo", repo: r } as ContextRef,
        label: repoShort(r),
        icon: <FolderGit2 />,
        kind: "repo",
      })),
    ];
  }, [state.projects, state.notes, state.github]);

  const mentionMatches =
    caretWord === null
      ? []
      : mentionables.filter((m) => m.label.toLowerCase().includes(caretWord.toLowerCase())).slice(0, 7);
  const commandMatches = slash === undefined ? [] : COMMANDS.filter((c) => c.cmd.startsWith(slash.toLowerCase()));
  const menu = mentionMatches.length ? "mention" : commandMatches.length ? "command" : null;
  const menuLen = menu === "mention" ? mentionMatches.length : commandMatches.length;
  // A new menu or query starts at the top.
  const [menuFor, setMenuFor] = useState({ menu, caretWord, slash });
  if (menu !== menuFor.menu || caretWord !== menuFor.caretWord || slash !== menuFor.slash) {
    setMenuFor({ menu, caretWord, slash });
    setMenuIndex(0);
  }
  const anyMenu = !!menu || modelOpen;
  const notifyMenu = useEffectEvent((open: boolean) => onMenuChange?.(open));
  useEffect(() => notifyMenu(anyMenu), [anyMenu]);

  const pickMention = (m: Mentionable) => {
    setMentions((cur) => [...cur.filter((r) => refKey(r) !== refKey(m.ref)), m.ref]);
    setText((t) => t.replace(/(^|\s)@([^\s@]*)$/, `$1@${m.label} `));
    area.current?.focus();
  };
  const pickCommand = (c: (typeof COMMANDS)[number]) => {
    setText(`/${c.cmd} `);
    area.current?.focus();
  };

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t, refs);
    setText("");
    setMentions([]);
  };

  return (
    <div className="relative">
      {menu && (
        <div className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-xl border border-border bg-popover/90 p-1 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/5">
          {menu === "mention"
            ? mentionMatches.map((m, i) => (
                <button
                  key={refKey(m.ref)}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(m);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm [&_svg]:size-3.5 [&_svg]:text-muted-foreground",
                    i === menuIndex && "bg-accent",
                  )}
                >
                  {m.icon}
                  <span className="flex-1 truncate">{m.label}</span>
                  <span className="text-2xs text-muted-foreground">{m.kind}</span>
                </button>
              ))
            : commandMatches.map((c, i) => (
                <button
                  key={c.cmd}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickCommand(c);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm [&_svg]:size-3.5 [&_svg]:text-muted-foreground",
                    i === menuIndex && "bg-accent",
                  )}
                >
                  {c.icon}
                  <span className="font-mono text-xs">/{c.cmd}</span>
                  <span>{c.label}</span>
                  <span className="ml-auto truncate text-2xs text-muted-foreground">{c.hint}</span>
                </button>
              ))}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/5%)] transition-colors focus-within:border-ring/50 dark:shadow-[0_14px_32px_-18px_rgb(0_0_0/75%)]",
          compact && "rounded-xl",
        )}
      >
        {refs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {refs.map((r) => {
              const { label, icon } = refLabel(r, state);
              const isPage = pageRef && refKey(r) === refKey(pageRef);
              return (
                <span
                  key={refKey(r)}
                  className="inline-flex h-6 max-w-56 items-center gap-1 rounded-md border border-border bg-muted pr-1 pl-1.5 text-xs text-foreground/85 [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
                  title={isPage ? "The page you're on is attached. Remove it to ask without it." : undefined}
                >
                  {icon}
                  <span className="truncate">{label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() =>
                      isPage ? setPageOff(true) : setMentions((cur) => cur.filter((m) => refKey(m) !== refKey(r)))
                    }
                    className="flex size-4 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <textarea
          ref={area}
          dir="auto"
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (menu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setMenuIndex((i) => (i + (e.key === "ArrowDown" ? 1 : menuLen - 1)) % menuLen);
              return;
            }
            if (menu && (e.key === "Enter" || e.key === "Tab")) {
              e.preventDefault();
              if (menu === "mention") pickMention(mentionMatches[menuIndex]);
              else pickCommand(commandMatches[menuIndex]);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") area.current?.blur();
          }}
          placeholder={busy ? "Working… you can type the next message" : "Ask anything. @ to mention, / for commands"}
          className="block max-h-[220px] w-full resize-none bg-transparent field-sizing-content px-3.5 pt-2.5 pb-1 text-sm leading-6 outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <ModelPicker providers={state.providers} value={selection} onChange={onSelect} onOpenChange={setModelOpen} />
          <span className="ml-1 hidden text-2xs text-muted-foreground/60 sm:inline">⌘K</span>
          <div className="ml-auto">
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop"
                aria-label="Stop"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!text.trim()}
                title="Send (Enter)"
                aria-label="Send"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:cursor-default disabled:opacity-30"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
