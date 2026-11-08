/** Linear-style priority glyph: urgent = filled square with "!", then 3/2/1 bars, none = dashes. */
import { cn } from "../ui.tsx";

export function PriorityIcon({ level, className }: { level: number; className?: string }) {
  if (level === 1)
    return (
      <svg viewBox="0 0 16 16" className={cn("size-3.5 shrink-0", className)} aria-hidden>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" className="fill-[#f2994a]" />
        <path d="M8 4.5v4.5M8 11.2v.3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  const bars = level === 2 ? 3 : level === 3 ? 2 : level === 4 ? 1 : 0;
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 shrink-0", className)} aria-hidden>
      {[0, 1, 2].map((i) =>
        level === 0 ? (
          <rect key={i} x={2 + i * 4.5} y="7.25" width="3" height="1.5" rx="0.75" className="fill-current opacity-45" />
        ) : (
          <rect
            key={i}
            x={2 + i * 4.5}
            y={10 - i * 3}
            width="3"
            height={4 + i * 3}
            rx="1"
            className={cn("fill-current", i >= bars && "opacity-25")}
          />
        ),
      )}
    </svg>
  );
}
