/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/WorkLog.tsx (WorkLogBlock/List/Row/Button/Details)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
/** Each work-log part owns its trailing space. */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../ui.tsx";

export function WorkLogBlock({ children }: { children: ReactNode }) {
  return <div className="pb-2">{children}</div>;
}

type RowContent = { icon?: ReactNode; label: ReactNode; trailing?: ReactNode; wrapLabel?: boolean };

function WorkLogLine({ icon, label, trailing, wrapLabel }: RowContent) {
  return (
    <div
      className={cn("flex min-h-6 min-w-0 gap-1.5 text-sm leading-relaxed", wrapLabel ? "items-start" : "items-center")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {icon ? <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span> : null}
        <div className={cn("min-w-0 flex-1 text-muted-foreground", !wrapLabel && "truncate [&_*]:whitespace-nowrap")}>
          {label}
        </div>
      </div>
      {trailing}
    </div>
  );
}

const rowClassName = "group/timeline-row relative w-full min-w-0 rounded-md px-0.5 py-0 text-left transition-colors";
const interactiveClassName =
  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70";

export function WorkLogButton({
  icon,
  label,
  trailing,
  ...props
}: RowContent & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button {...props} type="button" className={cn(rowClassName, interactiveClassName)}>
      <WorkLogLine icon={icon} label={label} trailing={trailing} />
    </button>
  );
}

export function WorkLogRow({
  icon,
  label,
  trailing,
  wrapLabel,
  children,
  ...props
}: RowContent & Omit<ComponentProps<"div">, "className">) {
  return (
    <div {...props} className={cn(rowClassName, props.onClick && interactiveClassName)}>
      <WorkLogLine icon={icon} label={label} trailing={trailing} wrapLabel={wrapLabel} />
      {children}
    </div>
  );
}

export function WorkLogDetails({ children }: { children: ReactNode }) {
  return (
    <div
      className="ms-7 flex max-h-96 cursor-auto flex-col gap-3 overflow-auto px-0.5 py-1 select-text"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
