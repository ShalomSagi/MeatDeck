import type { ReactNode } from "react";
import { cn } from "../ui.tsx";

export function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-sidebar-row-hover [&_svg]:size-4 [&_svg]:text-sidebar-muted-foreground",
        active && "bg-sidebar-row-active font-medium shadow-xs/5 dark:shadow-none [&_svg]:text-sidebar-foreground",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {!!count && <span className="text-2xs tabular-nums text-sidebar-muted-foreground">{count}</span>}
    </button>
  );
}
