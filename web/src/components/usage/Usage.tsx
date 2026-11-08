import { Bot, Layers } from "lucide-react";
import type { UsageSummary } from "../../../../shared/types.ts";
import { KIND_META } from "../runs/runKinds.tsx";
import { Card, SectionHeader } from "../ui.tsx";
import { BarList } from "./BarList.tsx";
import { Composition } from "./Composition.tsx";
import { DailyChart } from "./DailyChart.tsx";
import { LimitsCard } from "./LimitsCard.tsx";
import { Tile } from "./Tile.tsx";
import { fmtPct, pct } from "./Usage.logic.ts";
import { agoText, fmtTokens } from "../../lib.ts";

export function Usage({ usage }: { usage: UsageSummary }) {
  const { windows: w } = usage;
  const share7 = pct(w.last7d.meatdeck.total, w.last7d.all.total);
  const runs7 = usage.byRunKind.reduce((s, k) => s + k.runs, 0);

  return (
    <div className="flex flex-col gap-6">
      <LimitsCard limits={usage.limits} />

      <section>
        <SectionHeader
          title="MeatDeck vs. all Claude Code"
          icon={<Layers />}
          action={
            <span className="text-2xs text-muted-foreground/70">
              {usage.scanning ? "Counting…" : `Counted from local transcripts ${agoText(usage.scannedAt)}`}
            </span>
          }
        />
        <Card className="grid grid-cols-2 divide-border max-sm:[&>*:nth-child(-n+2)]:border-b sm:grid-cols-4 sm:divide-x">
          <Tile
            swatch="meatdeck"
            label="MeatDeck today"
            value={fmtTokens(w.today.meatdeck.total)}
            sub={`${fmtPct(pct(w.today.meatdeck.total, w.today.all.total))} of today's total`}
          />
          <Tile
            swatch="meatdeck"
            label="MeatDeck · 7 days"
            value={fmtTokens(w.last7d.meatdeck.total)}
            sub={runs7 ? `${runs7} runs · ${fmtPct(share7)} of your usage` : `${fmtPct(share7)} of your usage`}
          />
          <Tile
            label="All Claude Code today"
            value={fmtTokens(w.today.all.total)}
            sub={`last 5h ${fmtTokens(w.last5h.all.total)}`}
          />
          <Tile
            label="All Claude Code · 7 days"
            value={fmtTokens(w.last7d.all.total)}
            sub={`MeatDeck ${fmtPct(share7)} · 30d ${fmtTokens(w.last30d.all.total)}`}
          />
        </Card>
        <div className="mt-2 flex flex-col gap-1 px-1">
          <Composition t={w.last7d.meatdeck} />
          <p className="text-2xs text-muted-foreground/70">
            Totals include cache reads, which are most of the volume and cost about a tenth of fresh input. Output
            tokens are the expensive part.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <DailyChart daily={usage.daily} mode="meatdeck" />
        <DailyChart daily={usage.daily} mode="all" />
      </div>

      <section>
        <SectionHeader title="MeatDeck runs · 7 days" icon={<Bot />} />
        <Card className="overflow-hidden">
          {usage.byRunKind.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">Per-run numbers start with the next run.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead className="text-2xs text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 font-normal">Run</th>
                  <th className="px-2 py-2 text-right font-normal">Runs</th>
                  <th className="px-2 py-2 text-right font-normal">Tokens</th>
                  <th className="px-2 py-2 text-right font-normal">Per run</th>
                  <th className="px-4 py-2 text-right font-normal">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usage.byRunKind.map((k) => (
                  <tr key={k.kind}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
                        {KIND_META[k.kind].icon} {KIND_META[k.kind].label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{k.runs}</td>
                    <td className="px-2 py-2 text-right">{fmtTokens(k.tokens)}</td>
                    <td className="px-2 py-2 text-right">{fmtTokens(Math.round(k.tokens / k.runs))}</td>
                    <td className="px-4 py-2 text-right">{fmtTokens(k.output)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <SectionHeader title="Where your tokens go · 7 days" />
          <Card className="px-4 py-3.5">
            <BarList rows={usage.byProject.map((p) => ({ label: p.name, value: p.tokens, meatdeck: p.meatdeck }))} />
          </Card>
        </section>
        <section>
          <SectionHeader title="By model · 7 days" />
          <Card className="px-4 py-3.5">
            <BarList
              rows={usage.byModel.map((m) => ({
                label: m.model.replace(/^claude-/, ""),
                value: m.all,
                meatdeck: false,
              }))}
            />
            <p className="mt-3 text-2xs text-muted-foreground">
              MeatDeck's share by model:{" "}
              {usage.byModel
                .filter((m) => m.meatdeck > 0)
                .map((m) => `${m.model.replace(/^claude-/, "")} ${fmtTokens(m.meatdeck)}`)
                .join(" · ") || "none yet"}
            </p>
          </Card>
        </section>
      </div>
    </div>
  );
}
