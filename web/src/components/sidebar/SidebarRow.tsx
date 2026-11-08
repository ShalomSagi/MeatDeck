import { EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn, StatusDot } from "../ui.tsx";

export function SidebarRow({
  icon,
  label,
  title,
  mono,
  badge,
  total,
  needsMe,
  active,
  onClick,
  onHide,
}: {
  icon: ReactNode;
  /** Small glyph after the label (project priority). */
  badge?: ReactNode;
  label: string;
  title?: string;
  mono?: boolean;
  total: number;
  needsMe: number;
  active: boolean;
  onClick: () => void;
  onHide?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex h-7 w-full items-center rounded-md text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-row-hover",
        active && "bg-sidebar-row-active text-sidebar-foreground shadow-xs/5 dark:shadow-none",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        title={title ?? label}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 pl-2.5 text-left"
      >
        <span className="shrink-0 text-sidebar-muted-foreground">{icon}</span>
        <span className={cn("flex-1 truncate", mono && "font-mono text-[13px]")}>{label}</span>
        {badge}
        {needsMe > 0 && <StatusDot tone="error" />}
        <span className={cn("text-2xs tabular-nums text-sidebar-muted-foreground", onHide && "group-hover:hidden")}>
          {total || ""}
        </span>
      </button>
      {onHide ? (
        <>
          <button
            type="button"
            title={`Hide ${label}: no updates, no tokens`}
            aria-label={`Hide ${label}`}
            onClick={onHide}
            className="mr-1 hidden size-5 shrink-0 cursor-pointer items-center justify-center rounded text-sidebar-muted-foreground group-hover:flex hover:bg-accent hover:text-sidebar-foreground focus-visible:flex"
          >
            <EyeOff className="size-3.5" />
          </button>
          <span className="w-2.5 shrink-0 group-hover:hidden" />
        </>
      ) : (
        <span className="w-2.5 shrink-0" />
      )}
    </div>
  );
}
