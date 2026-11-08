import { Plus } from "lucide-react";

export function SidebarAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-5 cursor-pointer items-center justify-center rounded text-sidebar-muted-foreground hover:bg-accent hover:text-sidebar-foreground"
    >
      <Plus className="size-3.5" />
    </button>
  );
}
