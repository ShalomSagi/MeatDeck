import type { Tokens } from "../../../../shared/types.ts";
import { fmtTokens } from "../../lib.ts";

export function Composition({ t }: { t: Tokens }) {
  const parts = [
    ["Output", t.output],
    ["Input", t.input],
    ["Cache write", t.cacheWrite],
    ["Cache read", t.cacheRead],
  ] as const;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
      {parts.map(([k, v]) => (
        <span key={k}>
          {k} <span className="tabular-nums text-foreground/85">{fmtTokens(v)}</span>
        </span>
      ))}
    </div>
  );
}
