/** Collapsible sidebar group; open/closed is remembered per section. */
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../ui.tsx";

export function SidebarSection({
  id,
  title,
  action,
  count,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const key = `meatdeck:section:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };
  return (
    <div className="mt-3">
      <div className="group/section flex h-6 items-center pr-1 pl-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex h-full flex-1 cursor-pointer items-center gap-1 px-1.5 text-left text-2xs font-medium tracking-wide text-sidebar-muted-foreground uppercase hover:text-sidebar-foreground"
        >
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          {title}
          {!open && count !== undefined && count > 0 && (
            <span className="font-normal tabular-nums normal-case">· {count}</span>
          )}
        </button>
        <span className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
          {action}
        </span>
      </div>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
