import { CalendarDays, CircleDot, FileText, PenLine } from "lucide-react";
import type { Source } from "../../../shared/types.ts";

type P = { className?: string };

export const GithubIcon = ({ className }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const SlackIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="#E01E5A"
      d="M5.04 15.17a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.27 0a2.52 2.52 0 0 1 5.04 0v6.31a2.52 2.52 0 1 1-5.04 0v-6.31Z"
    />
    <path
      fill="#36C5F0"
      d="M8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52H8.83Zm0 1.27a2.52 2.52 0 0 1 0 5.04H2.52a2.52 2.52 0 0 1 0-5.04h6.31Z"
    />
    <path
      fill="#2EB67D"
      d="M18.96 8.83a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.83Zm-1.27 0a2.52 2.52 0 0 1-5.04 0V2.52a2.52 2.52 0 1 1 5.04 0v6.31Z"
    />
    <path
      fill="#ECB22E"
      d="M15.17 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.27a2.52 2.52 0 0 1 0-5.04h6.31a2.52 2.52 0 1 1 0 5.04h-6.31Z"
    />
  </svg>
);

export const LinearIcon = ({ className }: P) => (
  <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden>
    <path d="M1.22 61.52c-.22-.95.91-1.55 1.6-.86l36.52 36.52c.69.69.09 1.82-.86 1.6A50.07 50.07 0 0 1 1.22 61.52ZM0 46.89c-.02.29.09.57.29.77l52.05 52.05c.2.2.48.31.77.29 2.37-.15 4.69-.46 6.96-.93.77-.16 1.03-1.1.48-1.66L2.59 39.45c-.56-.56-1.5-.29-1.66.48-.47 2.27-.78 4.59-.93 6.96Zm4.21-17.18c-.17.38-.08.82.21 1.11l64.76 64.76c.29.29.73.38 1.11.21 1.79-.8 3.52-1.69 5.19-2.68.55-.33.64-1.09.19-1.55L8.44 24.33c-.45-.45-1.22-.37-1.55.19-.99 1.67-1.88 3.4-2.68 5.19Zm8.45-11.62a1.06 1.06 0 0 1-.04-1.45A49.9 49.9 0 0 1 50.06 0C77.64 0 100 22.36 100 49.94a49.9 49.9 0 0 1-16.6 37.44 1.06 1.06 0 0 1-1.45-.04L12.66 18.09Z" />
  </svg>
);

export function SourceIcon({ source, className = "size-3.5" }: { source: Source; className?: string }) {
  switch (source) {
    case "github":
      return <GithubIcon className={className} />;
    case "slack":
      return <SlackIcon className={className} />;
    case "linear":
      return <LinearIcon className={`${className} text-[#5E6AD2]`} />;
    case "calendar":
      return <CalendarDays className={className} />;
    case "notion":
      return <FileText className={className} />;
    case "manual":
      return <PenLine className={className} />;
    default:
      return <CircleDot className={className} />;
  }
}
