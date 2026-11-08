// The doc icon picker is frimousse with Emojibase data served by the app itself (/emojibase),
// so it works offline.
import { EmojiPicker, type EmojiPickerListComponents } from "frimousse";
import { Shuffle, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../ui.tsx";

const RANDOM = [
  "📄",
  "📝",
  "📌",
  "🚀",
  "🧪",
  "🛠️",
  "📊",
  "🗂️",
  "💡",
  "🎯",
  "🧭",
  "📦",
  "🔍",
  "🗓️",
  "✅",
  "🧩",
  "📈",
  "🔥",
  "🌱",
  "⚙️",
  "🧠",
  "📣",
  "🐛",
  "🏁",
];

const LIST_COMPONENTS: EmojiPickerListComponents = {
  CategoryHeader: ({ category, ...props }) => (
    <div className="bg-popover px-3 pt-3 pb-1.5 text-2xs font-medium text-muted-foreground" {...props}>
      {category.label}
    </div>
  ),
  Row: ({ children, ...props }) => (
    <div className="scroll-my-1.5 px-1.5" {...props}>
      {children}
    </div>
  ),
  Emoji: ({ emoji, ...props }) => (
    <button
      className="flex size-8 cursor-pointer items-center justify-center rounded-md text-xl data-[active]:bg-accent"
      {...props}
    >
      {emoji.emoji}
    </button>
  ),
};

/** The emoji grid with search, plus Random and Remove. */
function EmojiGrid({ onPick, onRemove }: { onPick: (emoji: string) => void; onRemove?: () => void }) {
  return (
    <div className="w-[332px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 text-xs">
        <span className="px-1 font-medium">Icon</span>
        <button
          type="button"
          onClick={() => onPick(RANDOM[Math.floor(Math.random() * RANDOM.length)])}
          className="ml-auto flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Shuffle className="size-3.5" /> Random
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        )}
      </div>
      <EmojiPicker.Root
        emojibaseUrl="/emojibase"
        columns={9}
        onEmojiSelect={({ emoji }) => onPick(emoji)}
        className="isolate flex h-[340px] flex-col"
      >
        <EmojiPicker.Search
          autoFocus
          placeholder="Filter…"
          className="z-10 mx-2 mt-2 appearance-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70 dark:bg-input/32"
        />
        <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
          <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading…
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No emoji found.
          </EmojiPicker.Empty>
          <EmojiPicker.List className="pb-1.5 select-none" components={LIST_COMPONENTS} />
        </EmojiPicker.Viewport>
      </EmojiPicker.Root>
    </div>
  );
}

/**
 * The doc page's icon, above the title: big emoji you click to change, or "Add icon" on hover
 * when there's none.
 */
export function DocIconPicker({ icon, onChange }: { icon?: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const pick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      {icon ? (
        <button
          type="button"
          title="Change icon"
          onClick={() => setOpen((o) => !o)}
          className="-ml-1.5 flex size-16 cursor-pointer items-center justify-center rounded-lg text-5xl leading-none transition-colors hover:bg-accent"
        >
          {icon}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "-ml-2 flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
            open ? "opacity-100" : "opacity-0 group-hover/doc:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Smile className="size-3.5" /> Add icon
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1">
          <EmojiGrid onPick={pick} onRemove={icon ? () => pick("") : undefined} />
        </div>
      )}
    </div>
  );
}
