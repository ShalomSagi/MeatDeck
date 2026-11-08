/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/UserMessageContextChips.tsx
 *   apps/web/src/components/ContextChip.tsx (chip styling)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import type { ContextRef, DashboardState } from "../../../../shared/types.ts";
import { refLabel } from "./contextRefs.tsx";

export function ContextChip({ r, state }: { r: ContextRef; state: DashboardState }) {
  const { label, icon } = refLabel(r, state);
  return (
    <span
      data-slot="context-chip"
      className="inline-flex max-w-full items-center gap-[0.25em] rounded-sm text-xs leading-[normal] font-medium text-foreground/75 [&_svg]:block [&_svg]:size-[1.1em] [&_svg]:shrink-0 [&_svg]:self-center [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="block min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap">{label}</span>
    </span>
  );
}
