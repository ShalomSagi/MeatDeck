// Context added to a run's system prompt: the digest (facts computed for free), the user's standing
// rules and their voice.
import type { RunKind } from "../../shared/types.ts";
import { digest } from "../digest.ts";
import { provider, runAction } from "../integrations.ts";
import { syncGithub } from "../reconcile.ts";
import { store } from "../store/store.ts";
import type { Job } from "./jobs.ts";

/** Facts computed for free and handed to Claude, so it doesn't spend tool calls fetching them. */
const DRAFTING = new Set<RunKind>(["morning", "manual", "pulse", "wrapup"]);

export async function contextFor(job: Job): Promise<string> {
  if (job.kind === "send") return "";
  if (job.kind === "voice") return await voiceContext();
  if (job.kind === "revise") return `\n\n${voiceBlock()}`;
  await syncGithub(); // fresh PR state via gh, plus deterministic todos/closures
  const d = digest({ focusProjectId: job.projectId });
  const voice = DRAFTING.has(job.kind) ? `\n\n${voiceBlock()}` : "";
  return `\n\nCurrent dashboard digest, computed for you just now (GitHub is fresh from gh). Use it instead of calling get_dashboard, refresh_github, \`date\` or gh for PR status:\n${JSON.stringify(d)}${voice}`;
}

// ---------- rules + permissions, shared by every run (scheduled, chat, revise…) ----------

/** The user's standing rules, appended to every Claude run. */
export function rulesBlock(): string {
  const rules = store.rules().filter((r) => r.enabled);
  if (!rules.length) return "";
  const lines = rules.map((r) =>
    r.kind === "ignore_check"
      ? `- CI checks matching "${r.pattern}" never count as failures (${r.text}). Code already excludes them, so don't report or act on them either.`
      : `- ${r.text}`,
  );
  return `\n\nThe user's standing rules. Always follow them, whatever this run is about:\n${lines.join("\n")}`;
}

/** Compact voice context for any run that writes in the user's name. */
export function voiceBlock(): string {
  const { profile, edits } = store.voiceState();
  if (!profile && !edits.length) return "";
  const cut = (t: string) => (t.length > 260 ? `${t.slice(0, 260)}…` : t);
  return `Write every drafted message in the user's own voice (not yours). Their voice, learned from their real messages:
${JSON.stringify({
  guide: profile?.guide ?? null,
  examples: (profile?.examples ?? []).slice(0, 5).map(cut),
  // How they rewrote your recent drafts before sending: the gap between these is what to fix.
  recentEdits: edits.slice(-3).map((e) => ({ yourDraft: cut(e.drafted), whatTheySent: cut(e.sent) })),
})}`;
}

/** Free inputs for voice learning: GitHub comments via gh, plus their edits to drafts. */
async function voiceContext(): Promise<string> {
  // Writing samples from the code-hosting integration (built-in gh for GitHub): free.
  let github: string[] = [];
  const code = provider("code", "listMyComments");
  if (code && code.actions.listMyComments.kind !== "claude") {
    const r = await runAction(code.id, "listMyComments");
    if (r.ok)
      github = (Array.isArray(r.output) ? r.output : String(r.output).split("\n"))
        .map(String)
        .slice(-25)
        .map((l) => (l.length > 280 ? `${l.slice(0, 280)}…` : l));
  }
  const { profile, edits } = store.voiceState();
  return `\n\nInputs gathered for you (free, no need to fetch them):\n${JSON.stringify({
    currentProfile: profile ?? null,
    editsToDrafts: edits.map((e) => ({ yourDraft: e.drafted, whatTheySent: e.sent, to: e.to })),
    githubComments: github,
  })}`;
}
