import type { ReactNode } from "react";

/** Just enough Markdown for Linear descriptions: headings, lists, **bold**, `code`, links. No HTML injection. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const inline = (line: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const re = /\[([^\]]+)\]\(<?([^)>\s]+)>?\)|\*\*([^*]+)\*\*|`([^`]+)`|(https?:\/\/[^\s)>]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push(line.slice(last, m.index));
      const k = `${key}-${i++}`;
      if (m[1])
        out.push(
          <a key={k} href={m[2]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {m[1]}
          </a>,
        );
      else if (m[3])
        out.push(
          <strong key={k} className="font-semibold text-foreground">
            {m[3]}
          </strong>,
        );
      else if (m[4])
        out.push(
          <code key={k} className="rounded bg-accent px-1 font-mono text-[0.85em]">
            {m[4]}
          </code>,
        );
      else if (m[5])
        out.push(
          <a key={k} href={m[5]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {m[5].replace(/^https?:\/\//, "").slice(0, 48)}
          </a>,
        );
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  // Split out fenced code blocks first; everything else is line-based. `at` (source line) keys the block.
  const blocks: { at: number; code?: string; lines?: string[] }[] = [];
  let buf: string[] = [];
  let code: string[] | null = null;
  let at = 0;
  for (const [i, l] of text.split("\n").entries()) {
    if (l.trim().startsWith("```")) {
      if (code) {
        blocks.push({ at, code: code.join("\n") });
        code = null;
      } else {
        if (buf.length) blocks.push({ at, lines: buf });
        buf = [];
        code = [];
        at = i;
      }
    } else if (code) code.push(l);
    else {
      if (!buf.length) at = i;
      buf.push(l);
    }
  }
  if (code) blocks.push({ at, code: code.join("\n") });
  if (buf.length) blocks.push({ at, lines: buf });

  return (
    <div dir="auto" className={className ?? "flex flex-col gap-1.5 text-sm leading-6 text-foreground/90"}>
      {blocks.flatMap((b) =>
        b.code !== undefined
          ? [
              <pre
                key={`c${b.at}`}
                className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs leading-5"
              >
                {b.code}
              </pre>,
            ]
          : b.lines!.map((raw, ln) => {
              const idx = `${b.at + ln}`;
              const line = raw.trimEnd();
              if (!line.trim()) return null;
              const h = /^(#{1,4})\s+(.*)$/.exec(line);
              if (h)
                return (
                  <p key={idx} className="mt-2 font-semibold text-foreground">
                    {inline(h[2], `h${idx}`)}
                  </p>
                );
              const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
              if (li)
                return (
                  <p
                    key={idx}
                    className="flex gap-2"
                    style={{ paddingLeft: `${Math.min(3, li[1].length / 2) * 1}rem` }}
                  >
                    <span className="shrink-0 text-muted-foreground">{/\d/.test(li[2]) ? li[2] : "•"}</span>
                    <span>{inline(li[3], `l${idx}`)}</span>
                  </p>
                );
              return <p key={idx}>{inline(line, `p${idx}`)}</p>;
            }),
      )}
    </div>
  );
}
