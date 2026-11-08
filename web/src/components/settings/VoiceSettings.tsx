/** How you write: learned from your Slack messages, GitHub comments and your edits to drafts. */
import { AudioLines, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { Button, Card, SectionHeader } from "../ui.tsx";
import { agoText } from "../../lib.ts";

export function VoiceSettings({ state }: { state: DashboardState }) {
  const { profile, edits, newEdits } = state.voice;
  const [guide, setGuide] = useState(profile?.guide ?? "");
  const [savedGuide, setSavedGuide] = useState(profile?.guide);
  if (profile?.guide !== savedGuide) {
    setSavedGuide(profile?.guide);
    setGuide(profile?.guide ?? "");
  }
  const learning =
    (state.run?.status === "running" && state.run.kind === "voice") ||
    state.nextRuns.some((n) => n.kind === "voice" && n.at === "queued");

  return (
    <section>
      <SectionHeader
        title="Your voice"
        icon={<AudioLines />}
        action={
          <Button size="xs" variant="ghost" disabled={learning} onClick={() => void api.learnVoice()}>
            {learning ? <LoaderCircle className="animate-spin" /> : <AudioLines />}
            {learning ? "Learning…" : profile ? "Re-learn" : "Learn from my messages"}
          </Button>
        }
      />
      <Card className="divide-y divide-border">
        <p className="px-4 py-3 text-xs leading-4.5 text-muted-foreground">
          Every draft is written to sound like you. Claude studies your recent Slack messages and GitHub comments
          (re-learned weekly). Each time you edit a draft before sending, MeatDeck keeps "what Claude wrote vs. what you
          sent" for free, and the latest of those go into every run that drafts.
          {profile && (
            <>
              {" "}
              Learned {agoText(profile.updatedAt)}
              {profile.sources &&
                ` from ${[
                  profile.sources.slack && `${profile.sources.slack} Slack messages`,
                  profile.sources.github && `${profile.sources.github} GitHub comments`,
                  profile.sources.edits && `${profile.sources.edits} edits`,
                ]
                  .filter(Boolean)
                  .join(", ")}`}
              .
            </>
          )}
          {edits.length > 0 &&
            ` ${edits.length} edit${edits.length === 1 ? "" : "s"} collected${newEdits ? `, ${newEdits} new since then` : ""}.`}
        </p>
        {profile ? (
          <>
            <div className="px-4 py-3">
              <p className="mb-1.5 text-2xs font-medium text-muted-foreground uppercase">Style guide · editable</p>
              <textarea
                value={guide}
                onChange={(e) => setGuide(e.target.value)}
                onBlur={() => guide.trim() !== profile.guide && void api.setVoice({ guide })}
                rows={Math.min(14, Math.max(5, guide.split("\n").length + 1))}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20 dark:bg-input/32"
              />
            </div>
            {profile.examples.length > 0 && (
              <div className="px-4 py-3">
                <p className="mb-2 text-2xs font-medium text-muted-foreground uppercase">Real examples</p>
                <div className="flex flex-col gap-1.5">
                  {profile.examples.map((e) => (
                    <p
                      key={e}
                      dir="auto"
                      className="rounded-lg bg-muted px-3 py-1.5 text-sm leading-5 text-foreground/85"
                    >
                      {e}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {learning
              ? "Reading your messages…"
              : "Not learned yet. It happens automatically after the next morning brief, or press Learn now."}
          </p>
        )}
      </Card>
    </section>
  );
}
