import { Gauge } from "lucide-react";
import type { UsageLimits } from "../../../../shared/types.ts";
import { clock } from "../runs/runKinds.tsx";
import { Card, SectionHeader } from "../ui.tsx";
import { LimitMeter } from "./LimitMeter.tsx";
import { PACE_LABEL, paceOf } from "./Usage.logic.ts";
import { useMinuteClock } from "./useMinuteClock.ts";
import { agoText } from "../../lib.ts";

export function LimitsCard({ limits }: { limits?: UsageLimits }) {
  const now = useMinuteClock();
  return (
    <section>
      <SectionHeader
        title="Claude limits"
        icon={<Gauge />}
        action={
          limits && (
            <span className="text-2xs text-muted-foreground/70">as of MeatDeck's last run, {agoText(limits.at)}</span>
          )
        }
      />
      <Card className="px-4 py-3.5">
        {!limits ? (
          <p className="text-sm text-muted-foreground">
            Appears after MeatDeck's next Claude run. Claude reports the limits in every run's stream, so reading them
            costs nothing.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {limits.windows.map((w) => {
              const pace = paceOf(w, now);
              return (
                <div key={w.id}>
                  <LimitMeter w={w} />
                  <p className="mt-1 pl-[7.25rem] text-2xs text-muted-foreground">
                    {w.resetsAt && `Resets ${clock(w.resetsAt)}`}
                    {pace && ` · ${PACE_LABEL[pace]}`}
                  </p>
                </div>
              );
            })}
            {limits.overage?.usingOverage && (
              <p className="text-2xs text-warning-foreground">Using extra usage (overage).</p>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
