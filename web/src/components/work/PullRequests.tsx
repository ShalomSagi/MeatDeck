import { CircleCheck, CircleDashed, CircleX, Eye, GitPullRequest, GitPullRequestDraft } from "lucide-react";
import type { Action } from "../../../../shared/actions.ts";
import type { GithubPr, GithubSnapshot } from "../../../../shared/types.ts";
import { PrimaryButton } from "../queue/PrimaryButton.tsx";
import { Badge, Card, cn, Empty, SectionHeader, StatusDot } from "../ui.tsx";
import { ago, people, prSignals } from "../../lib.ts";

function Checks({ state }: { state: GithubPr["checks"] }) {
  if (state === "SUCCESS") return <CircleCheck className="size-3.5 text-success" aria-label="Checks passing" />;
  if (state === "FAILURE" || state === "ERROR")
    return <CircleX className="size-3.5 text-destructive" aria-label="Checks failing" />;
  if (state === "PENDING" || state === "EXPECTED")
    return (
      <CircleDashed className="size-3.5 animate-[spin_3s_linear_infinite] text-warning" aria-label="Checks running" />
    );
  return <span className="size-3.5" />;
}

function PrRow({ pr, review, action }: { pr: GithubPr; review?: boolean; action?: Action }) {
  const signals = review ? [] : prSignals(pr);
  const Icon = pr.isDraft ? GitPullRequestDraft : GitPullRequest;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/60 sm:grid-cols-[auto_1fr_auto_auto_auto]">
      <Icon className={cn("mt-0.5 size-4", pr.isDraft ? "text-muted-foreground" : "text-success")} />
      <div className="min-w-0">
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm leading-5 hover:underline hover:underline-offset-2"
        >
          {pr.title}
        </a>
        {action && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs">
            <StatusDot tone={action.tier === "now" ? "error" : action.tier === "today" ? "warning" : "muted"} />
            <span className="text-foreground/85">{action.title}</span>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="font-mono">
            {pr.repo.split("/")[1]}#{pr.number}
          </span>
          {review && <span>by {pr.author}</span>}
          {pr.approvedBy.length > 0 && <Badge variant="success">✓ {people(pr.approvedBy)}</Badge>}
          {signals.map((s) => (
            <Badge key={s.label} variant={s.variant}>
              {s.label}
            </Badge>
          ))}
        </div>
      </div>
      <div className="mt-0.5 hidden sm:block">
        <Checks state={pr.checks} />
      </div>
      <span className="mt-0.5 text-2xs tabular-nums text-muted-foreground/70">{ago(pr.updatedAt)}</span>
      <div className="hidden sm:block">
        {action && <PrimaryButton a={action} expanded={false} onToggle={() => {}} pending={false} sending={false} />}
      </div>
    </div>
  );
}

const NO_ACTIONS: Action[] = [];

export function PullRequests({ github, actions = NO_ACTIONS }: { github: GithubSnapshot; actions?: Action[] }) {
  const actionFor = (url: string) => actions.find((a) => a.url === url);
  // Most urgent first, by the same score Today uses.
  const mine = [...github.mine].sort((a, b) => (actionFor(b.url)?.score ?? -1) - (actionFor(a.url)?.score ?? -1));
  return (
    <div className="flex flex-col gap-5">
      {github.error && (
        <Card className="border-destructive/30 bg-destructive/4 px-3 py-2.5 text-xs text-destructive-foreground">
          GitHub fetch failed: <span className="font-mono">{github.error}</span>
        </Card>
      )}
      <section>
        <SectionHeader title="Review requests" icon={<Eye />} count={github.reviewRequests.length} />
        <Card className="divide-y divide-border overflow-hidden">
          {github.reviewRequests.length === 0 ? (
            <Empty title="Inbox zero" hint="No one is waiting on your review." />
          ) : (
            github.reviewRequests.map((pr) => <PrRow key={pr.id} pr={pr} review action={actionFor(pr.url)} />)
          )}
        </Card>
      </section>
      <section>
        <SectionHeader title="My open PRs" icon={<GitPullRequest />} count={github.mine.length} />
        <Card className="divide-y divide-border overflow-hidden">
          {github.mine.length === 0 ? (
            <Empty title="No open PRs" />
          ) : (
            mine.map((pr) => <PrRow key={pr.id} pr={pr} action={actionFor(pr.url)} />)
          )}
        </Card>
      </section>
    </div>
  );
}
