import type { ReactNode } from "react";
import { cn } from "../ui.tsx";

export function FooterButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground [&_svg]:size-4",
        active && "bg-sidebar-row-active text-sidebar-foreground",
      )}
    >
      {children}
    </button>
  );
}
