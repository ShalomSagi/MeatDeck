// Two charts, each on its own scale: MeatDeck alone (the focus; it would be a sliver
// next to everything else), and all Claude Code with MeatDeck stacked in for context.
import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import type { UsageSummary } from "../../../../shared/types.ts";
import { Button, Card, cn, SectionHeader } from "../ui.tsx";
import { fmtPct, niceStep, pct } from "./Usage.logic.ts";
import { fmtTokens } from "../../lib.ts";

export function DailyChart({ daily, mode }: { daily: UsageSummary["daily"]; mode: "meatdeck" | "all" }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640;
  const H = 170;
  const padL = 40;
  const padB = 22;
  const plotW = W - padL;
  const plotH = H - padB - 8;
  const valueOf = (d: UsageSummary["daily"][number]) => (mode === "meatdeck" ? d.meatdeck : d.all);
  const max = Math.max(1, ...daily.map(valueOf));
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = plotW / daily.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => 8 + plotH - (v / top) * plotH;
  const label = (date: string) => {
    const [yy, mm, dd] = date.split("-").map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "narrow" });
  };
  const title = mode === "meatdeck" ? "MeatDeck tokens per day" : "All Claude Code tokens per day";
  const tipLeft = hover === null ? 0 : Math.min(84, Math.max(16, ((padL + band * hover + band / 2) / W) * 100));

  return (
    <section>
      <SectionHeader
        title={title}
        icon={<BarChart3 />}
        action={
          <Button size="xs" variant="ghost-muted" onClick={() => setTable((t) => !t)}>
            {table ? <BarChart3 /> : <Table2 />} {table ? "Chart" : "Table"}
          </Button>
        }
      />
      <Card className="px-4 pt-3 pb-2">
        <div className="mb-2 flex items-center gap-4 text-2xs text-muted-foreground">
          {mode === "all" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-series-meatdeck" /> MeatDeck
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-series-other" /> Everything else
              </span>
            </>
          ) : (
            <span>Every Claude run MeatDeck made: scheduled, manual and sends</span>
          )}
          <span className="ml-auto">last 14 days</span>
        </div>
        {table ? (
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 font-normal">Day</th>
                <th className="py-1 text-right font-normal">MeatDeck</th>
                <th className="py-1 text-right font-normal">All Claude Code</th>
                <th className="py-1 text-right font-normal">MeatDeck share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...daily].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="py-1">{d.date}</td>
                  <td className="py-1 text-right">{fmtTokens(d.meatdeck)}</td>
                  <td className="py-1 text-right">{fmtTokens(d.all)}</td>
                  <td className="py-1 text-right">{fmtPct(pct(d.meatdeck, d.all))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text
                    x={padL - 8}
                    y={y(t)}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {fmtTokens(t)}
                  </text>
                </g>
              ))}
              {daily.map((d, i) => {
                const cx = padL + band * i + band / 2;
                const x = cx - barW / 2;
                const meat = d.meatdeck;
                const other = mode === "all" ? d.all - d.meatdeck : 0;
                const yMeat = y(meat);
                const hMeat = plotH + 8 - yMeat;
                const gap = meat > 0 && other > 0 ? 2 : 0;
                const yTop = y(meat + other);
                const hOther = Math.max(0, yMeat - yTop - gap);
                return (
                  <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.55}>
                    {hMeat > 0.5 && (
                      <Column
                        x={x}
                        y={yMeat}
                        w={barW}
                        h={hMeat}
                        rounded={hOther <= 0.5}
                        fill="var(--series-meatdeck)"
                      />
                    )}
                    {hOther > 0.5 && <Column x={x} y={yTop} w={barW} h={hOther} rounded fill="var(--series-other)" />}
                    <text x={cx} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                      {label(d.date)}
                    </text>
                    {/* hit target: the whole band, bigger than the mark */}
                    <rect
                      x={padL + band * i}
                      y={0}
                      width={band}
                      height={H}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </svg>
            {hover !== null && (
              <div
                className="pointer-events-none absolute top-1 z-10 w-44 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg"
                style={{ left: `${tipLeft}%` }}
              >
                <div className="mb-1 font-medium">{daily[hover].date}</div>
                <Row swatch="bg-series-meatdeck" label="MeatDeck" value={fmtTokens(daily[hover].meatdeck)} />
                {mode === "all" && (
                  <Row
                    swatch="bg-series-other"
                    label="Everything else"
                    value={fmtTokens(daily[hover].all - daily[hover].meatdeck)}
                  />
                )}
                <div className="mt-1 border-t border-border pt-1 text-muted-foreground">
                  {fmtPct(pct(daily[hover].meatdeck, daily[hover].all))} of {fmtTokens(daily[hover].all)} total
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

function Row({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-[2px]", swatch)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto tabular-nums">{value}</span>
    </div>
  );
}

/** Column with a 4px rounded data-end and a square base. */
function Column({
  x,
  y,
  w,
  h,
  rounded,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rounded: boolean;
  fill: string;
}) {
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  return <path d={d} fill={fill} />;
}
