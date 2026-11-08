/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/TimelineToolActivityIcon.tsx (icon names → lucide icons)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import { Bot, Brain, Eye, Globe, Hammer, ListTodo, Search, SquarePen, Terminal, Wrench, Zap } from "lucide-react";
import type { IconName } from "./WorkEntryRow.logic.ts";

const ICONS: Record<IconName, typeof Terminal> = {
  terminal: Terminal,
  eye: Eye,
  "square-pen": SquarePen,
  search: Search,
  globe: Globe,
  bot: Bot,
  "list-todo": ListTodo,
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  brain: Brain,
};

export function WorkEntryIcon({ name, className }: { name: IconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} />;
}
