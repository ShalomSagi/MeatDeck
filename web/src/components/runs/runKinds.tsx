import { AudioLines, FolderSearch, Play, Send, Sunrise, Sunset, Timer, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import type { RunKind } from "../../../../shared/types.ts";
import { LinearIcon } from "../icons.tsx";

export const KIND_META: Record<RunKind, { label: string; icon: ReactNode }> = {
  morning: { label: "Morning brief", icon: <Sunrise /> },
  manual: { label: "Plan my day", icon: <Play /> },
  pulse: { label: "Pulse check", icon: <Timer /> },
  wrapup: { label: "Wrap-up", icon: <Sunset /> },
  send: { label: "Send", icon: <Send /> },
  project: { label: "Project context", icon: <FolderSearch /> },
  revise: { label: "Change", icon: <Wand2 /> },
  voice: { label: "Learn your voice", icon: <AudioLines /> },
  linear: { label: "Linear sync", icon: <LinearIcon className="text-[#5E6AD2]" /> },
};

export function clock(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}
