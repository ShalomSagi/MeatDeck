import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import type { Project, ProjectRules } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { Markdown } from "../Markdown.tsx";
import { LinearIcon } from "../icons.tsx";
import { Card, SectionHeader } from "../ui.tsx";
import { agoText } from "../../lib.ts";

const RULE_LABELS: Record<keyof ProjectRules, string> = {
  linearIssues: "Tickets",
  linearProjects: "Linear projects",
  slackChannels: "Slack channels",
  keywords: "Keywords",
  repos: "Whole repos",
};

/** The project's description and the rules that match work to it, folded away by default. */
export function ProjectAbout({ project: p }: { project: Project }) {
  const [description, setDescription] = useState(p.description);
  const [savedDescription, setSavedDescription] = useState(p.description);
  if (p.description !== savedDescription) {
    setSavedDescription(p.description);
    setDescription(p.description);
  }
  const ruleCount = Object.values(p.rules).reduce((n, v) => n + v.length, 0);

  return (
    <details className="group/about">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open/about:rotate-90" />
        About this project
        <span className="font-normal normal-case">· description and how work is matched to it</span>
      </summary>
      <div className="mt-3 flex flex-col gap-6">
        {p.kind === "linear" ? (
          // Linear projects: the description is Linear's, synced automatically. Edit it in Linear.
          <section>
            <SectionHeader
              title="Description"
              icon={<LinearIcon className="text-[#5E6AD2]" />}
              action={
                <span className="flex items-center gap-2 text-2xs text-muted-foreground/70">
                  {p.linearSyncedAt ? `From Linear · synced ${agoText(p.linearSyncedAt)}` : "Syncing from Linear…"}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Open in Linear →
                    </a>
                  )}
                </span>
              }
            />
            <Card className="px-4 py-3">
              {p.description ? (
                <Markdown text={p.description} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {p.linearSyncedAt
                    ? "This project has no description in Linear."
                    : "Fetching the description from Linear…"}
                </p>
              )}
            </Card>
          </section>
        ) : (
          <section>
            <SectionHeader title="Description" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== p.description && void api.updateProject(p.id, { description })}
              rows={3}
              placeholder="What is this project? Codenames, ticket prefixes, people, repos, channels. Claude uses it to find related work."
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
            />
          </section>
        )}

        <section>
          <SectionHeader
            title="How it's grouped"
            count={ruleCount}
            action={
              <span className="text-2xs text-muted-foreground/70">
                Rules Claude learned. Code applies them to new work at no token cost.
              </span>
            }
          />
          <Card className="divide-y divide-border">
            {ruleCount === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No rules yet.</p>}
            {(Object.keys(RULE_LABELS) as (keyof ProjectRules)[])
              .filter((k) => p.rules[k].length)
              .map((k) => (
                <div key={k} className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
                  <span className="w-32 text-xs text-muted-foreground">{RULE_LABELS[k]}</span>
                  {p.rules[k].map((v) => (
                    <span
                      key={v}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted pr-1 pl-2 font-mono text-xs"
                    >
                      {k === "slackChannels" ? `#${v}` : v}
                      <button
                        type="button"
                        aria-label={`Remove rule ${v}`}
                        title="Remove this rule (it over-matches)"
                        onClick={() => void api.updateProject(p.id, { removeRules: { [k]: [v] } })}
                        className="flex size-4 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ))}
          </Card>
        </section>
      </div>
    </details>
  );
}
