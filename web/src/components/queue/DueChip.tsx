import { Badge } from "../ui.tsx";
import { daysUntil } from "./DueChip.logic.ts";

export function DueChip({ due, today }: { due: string; today: string }) {
  const days = daysUntil(due, today);
  const label =
    days < 0
      ? `Overdue ${-days}d`
      : days === 0
        ? "Due today"
        : days === 1
          ? "Due tomorrow"
          : `Due ${new Date(`${due}T00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`;
  return <Badge variant={days <= 0 ? "error" : days === 1 ? "warning" : "default"}>{label}</Badge>;
}
