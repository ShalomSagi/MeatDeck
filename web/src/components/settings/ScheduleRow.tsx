import { Play } from "lucide-react";
import type { ReactNode } from "react";
import { Button, cn, Switch } from "../ui.tsx";

export function ScheduleRow({
  id,
  icon,
  title,
  hint,
  enabled,
  onToggle,
  onRun,
  children,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onRun: () => void;
  children: ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
        </div>
        <p className="mt-0.5 max-w-md text-xs leading-4.5 text-muted-foreground">{hint}</p>
        <div className={cn("mt-2.5 flex flex-wrap items-center gap-2", !enabled && "pointer-events-none opacity-50")}>
          {children}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="xs" variant="ghost" onClick={onRun}>
          <Play /> Run now
        </Button>
        <Switch checked={enabled} onChange={onToggle} label={title} />
      </div>
    </div>
  );
}
