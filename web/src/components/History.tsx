import { Check, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardState, Day } from "../../../shared/types.ts";
import { formatDay } from "../lib.ts";
import { Card, Empty, SectionHeader, cn } from "./ui.tsx";

export function History({ history }: { history: DashboardState["history"] }) {
  const [selected, setSelected] = useState<string | undefined>(history[1]?.date ?? history[0]?.date);
  const [day, setDay] = useState<Day | null>(null);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/day/${selected}`)
      .then((r) => r.json())
      .then(setDay);
  }, [selected]);

  if (history.length === 0) return <Empty icon={<HistoryIcon />} title="No history yet" />;

  return (
    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="h-fit overflow-hidden p-1">
        {history.map((h) => (
          <button
            key={h.date}
            type="button"
            onClick={() => setSelected(h.date)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
              selected === h.date && "bg-accent",
            )}
          >
            <span className="flex-1">{formatDay(h.date).split(",").slice(0, 2).join(",")}</span>
            <span className="text-2xs tabular-nums text-muted-foreground">
              {h.done}/{h.total}
            </span>
          </button>
        ))}
      </Card>
      {day && (
        <div className="flex flex-col gap-4">
          {day.brief && <Card className="px-4 py-3 text-sm leading-6 text-foreground/90">{day.brief.summary}</Card>}
          <section>
            <SectionHeader title="Todos" count={day.todos.length} />
            <Card className="divide-y divide-border">
              {day.todos.length === 0 && <Empty title="No todos that day" />}
              {day.todos.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-[4px] border",
                      t.status === "done" ? "border-success bg-success text-white" : "border-input",
                    )}
                  >
                    {t.status === "done" && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn(t.status !== "open" && "text-muted-foreground line-through")}>{t.title}</span>
                </div>
              ))}
            </Card>
          </section>
          {day.messages.length > 0 && (
            <section>
              <SectionHeader title="Messages" count={day.messages.length} />
              <Card className="divide-y divide-border">
                {day.messages.map((m) => (
                  <div key={m.id} className="px-3 py-2 text-sm">
                    <span className="font-medium">{m.to}</span>{" "}
                    <span className="text-2xs text-muted-foreground">{m.status}</span>
                    <p className="text-xs text-muted-foreground">{m.text}</p>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
