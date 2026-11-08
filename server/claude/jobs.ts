// What each kind of Claude run is: its label, prompt, tools and model. Building a job costs nothing;
// runQueue.ts runs it.
import type { Action } from "../../shared/actions.ts";
import type { ClaudeRun, Message, RunKind, Todo } from "../../shared/types.ts";
import { provider } from "../integrations.ts";
import { store } from "../store/store.ts";
import { DASHBOARD, projectDiscovery, readOnly, sendTools } from "./allowlists.ts";

export interface Job {
  kind: RunKind;
  label: string;
  trigger: ClaudeRun["trigger"];
  prompt: string;
  tools: string[];
  /** Called with the run result (used by send to mark messages failed). */
  onDone?: (ok: boolean, run: ClaudeRun, lastText: string) => void;
  /** Project discovery runs: the project in focus. */
  projectId?: string;
  /** Revise runs: "message:<id>" / "todo:<id>" and what the user asked. */
  target?: string;
  instruction?: string;
  model?: string;
}

export function jobFor(
  kind: Exclude<RunKind, "send" | "project" | "revise" | "voice" | "linear">,
  trigger: ClaudeRun["trigger"],
): Job {
  const prompts: Record<Exclude<typeof kind, "voice">, [string, string]> = {
    morning: ["Morning brief", "/today"],
    manual: ["Plan my day", "/today"],
    pulse: ["Pulse check", "/today pulse"],
    wrapup: ["Wrap-up", "/today wrap up"],
  };
  const [label, prompt] = prompts[kind];
  return { kind, label, trigger, prompt, tools: readOnly() };
}

/** One-off pass that teaches a project its matching rules and writes its context. */
export function projectJob(projectId: string): Job {
  const project = store.projects().find((p) => p.id === projectId);
  return {
    kind: "project",
    label: `Project context · ${project?.name ?? projectId}`,
    trigger: "you",
    prompt: `/today project ${projectId}`,
    tools: projectDiscovery(),
    projectId,
    onDone: (ok) => {
      if (ok && project) store.updateProject(projectId, { lastDiscoveryAt: new Date().toISOString() });
    },
  };
}

// Pulling a Linear project's description needs Linear's connector; nothing else. Small model, two tools.

/** Copy descriptions of Linear projects into MeatDeck (read-only display there). */
export function linearSyncJob(projects: { id: string; name: string }[]): Job {
  return {
    kind: "linear",
    label: projects.length === 1 ? `Linear · ${projects[0].name}` : `Linear · ${projects.length} projects`,
    trigger: "schedule",
    tools: [...DASHBOARD, "ToolSearch", ...projectTools()],
    model: store.settings().pulseModel || undefined,
    prompt: `Copy these Linear projects' descriptions and priorities into MeatDeck. Do nothing else.
${projects.map((p) => `- MeatDeck id ${p.id}: Linear project "${p.name}"`).join("\n")}

For each one, get the project (${projectHow()}). Then call the meatdeck update_project tool with:
- id: the MeatDeck id
- description: the project's description as written in Linear, verbatim (trim to about 1500 characters). If Linear also has a short summary, put it first. If there's a lead or target date, add one last line, e.g. "Lead: Dana · Target: 2026-12-01".
- url: the project's Linear URL
- linearPriority: the project's priority in Linear as a number: 0 no priority, 1 urgent, 2 high, 3 medium, 4 low
- fromLinear: true
If a project can't be found, call update_project with fromLinear: true and an empty description.
Reply in one line.`,
  };
}

/** "Change…" on a card: one narrow run that applies the user's instruction to that one thing. */
/**
 * Act on one queue action with a small run: draft a nudge (no instruction), or apply what the user
 * typed in "Change…" (re-prioritize, reword, snooze-like "not until Thursday", draft a reply…).
 */
export function actionJob(action: Action, instruction?: string): Job {
  const nudge = !instruction;
  return {
    kind: "revise",
    label: nudge
      ? `${action.verb === "ask" ? "Draft ask" : "Draft nudge"} · ${action.title.slice(0, 40)}`
      : `Change · ${action.title.slice(0, 40)}`,
    trigger: "you",
    tools: readOnly(),
    target: `action:${action.key}`,
    instruction: instruction ?? "Draft a nudge",
    model: store.settings().pulseModel || undefined,
    prompt:
      nudge && action.verb === "ask"
        ? `The user pressed "Draft ask" on their open PR in MeatDeck: they haven't asked anyone to review it yet.
${JSON.stringify(action)}

Draft the review request with draft_messages. Never send.
1. Where: ${(() => {
            const places = store.reviewAskLog().filter((x) => x.repo === action.pr?.repo);
            return places.length
              ? `they've asked for ${action.pr?.repo} reviews in: ${[...new Set(places.map((p) => p.where))].slice(0, 4).join(", ")} (most recent last). Use the usual place unless this PR clearly belongs elsewhere.`
              : `no history yet. Search Slack once for where they shared ${action.pr?.repo} PR links before (from:me, "github.com/${action.pr?.repo}/pull"), and use the channel or person they usually ask. If the PR is for a specific teammate's area, a DM to them may fit better.`;
          })()}
2. What: one or two short lines in the user's voice (below): what the PR does and anything that makes it urgent or easy (small, blocks X, part of a stack), then the link ${action.pr?.url ?? ""}. No headings, no bullet lists.
Set url to "${action.url ?? ""}" exactly, and set target (Slack channel or user id). Reply in one line: where you drafted it.`
        : nudge
          ? `The user pressed "Draft nudge" on this item in their MeatDeck queue:
${JSON.stringify(action)}

Draft one short follow-up message to the person or people they're waiting on, in the user's voice (below).${
              action.verb === "wait"
                ? ` This is earlier than the usual nudge time${action.nudgeIn ? ` (MeatDeck would have suggested it in ${action.nudgeIn})` : ""}: the user chose to move faster, so it's likely urgent for them. Say briefly why it matters now if you can tell from context; don't apologise for the timing or pretend it's been long.`
                : ""
            } Use draft_messages. Set url to "${action.url ?? ""}" exactly (that's how the app attaches the draft to this item), and set target (Slack user or channel id) and threadTs if it belongs in a thread.
Before writing, check where the conversation actually lives: if it continued in a DM, draft to that DM. If the person already answered somewhere, don't draft; reply with one line saying so. Never send.
Reply in one line.`
          : `The user pressed "Change…" on this item in their MeatDeck queue and said:
"${instruction!.replace(/"/g, "'")}"

The item:
${JSON.stringify(action)}

Do what they asked with your tools. Never send anything.
- Priority or urgency ("not urgent", "this blocks the release", "after Thursday"): call set_priorities for key "${action.key}" with a tier (now / today / watch) and a one-line why.
- Wording or the todo itself: update_todo / update_message (ids are in the item).
- A message they want sent later: draft_messages (url "${action.url ?? ""}").
- If it reveals a general habit, also call remember_preference with one short rule.
Reply in one line: what you changed.`,
  };
}

export function reviseJob(kind: "message" | "todo", entity: Message | Todo, instruction: string): Job {
  const what = kind === "message" ? `draft message to ${(entity as Message).to}` : `todo "${(entity as Todo).title}"`;
  return {
    kind: "revise",
    label: `Change · ${what.length > 40 ? `${what.slice(0, 40)}…` : what}`,
    trigger: "you",
    tools: readOnly(),
    target: `${kind}:${entity.id}`,
    instruction,
    model: store.settings().pulseModel || undefined,
    prompt: `The user pressed "Change…" on a ${kind} in MeatDeck and asked:
"${instruction.replace(/"/g, "'")}"

The ${kind} as it is now:
${JSON.stringify(entity)}

Do exactly what they asked, with your tools. Never send anything to anyone.
- A message: use update_message to change any of text, to, channel, target, threadTs or reason, and keep its status. To move it to someone's DM, find their Slack user id (slack_search_users), then set channel "slack", target to that user id, threadTs to null, and to to their name. If the change depends on a conversation (for example "we continued in DM"), read that conversation first (slack_search_public_and_private / slack_read_channel on the DM). Then rewrite the text for its new place, in the user's voice (below): a DM continuing a private discussion reads differently from a channel nudge. Update reason with the new evidence.
- A todo: use update_todo (title, notes, priority, due, status). To split it, add_todos the new ones and mark this one skipped.
- If they say it isn't needed (for example "already handled"), dismiss the message or skip the todo.

Then, only if this correction shows a general habit that should apply next time (not a one-off detail), call remember_preference with one short, general rule. For example: "If a channel thread continued in DM, follow up in that DM, not in the channel."
Reply in one line: what you changed.`,
  };
}

export function sendJob(messages: Message[]): Job {
  const list = messages
    .map(
      (m) =>
        `- id: ${m.id}\n  channel: ${m.channel}\n  to: ${m.to}\n  target: ${m.target ?? "(not set — look it up by name)"}\n  threadTs: ${m.threadTs ?? "(none)"}\n  url: ${m.url ?? "(none)"}\n  text (send VERBATIM, do not edit):\n${m.text
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n")}`,
    )
    .join("\n");
  return {
    kind: "send",
    label: messages.length === 1 ? `Send to ${messages[0].to}` : `Send ${messages.length} messages`,
    trigger: "you",
    tools: sendTools(),
    prompt: `The user clicked Send in MeatDeck for these approved messages. Send each one exactly as written, to exactly the stated recipient, and nothing else.

${list}

How to send: use the integration that handles each message's channel (the integrations block below says which tool does "Send a message" and "Comment on an issue"). A target that's a user id means a DM; a channel id posts there; use the thread id when set. If target isn't set, find the person or channel with that integration's "Find a person" action; if it's ambiguous, don't send that one.

After each one goes out, call the meatdeck update_message tool with status "sent". If one can't be sent, leave its status as is and say why in one line. Do not send anything that isn't in the list above.`,
  };
}

/** Learn (or refresh) how the user writes from their Slack messages, GitHub comments and draft edits. */
export function voiceJob(trigger: ClaudeRun["trigger"] = "you"): Job {
  return {
    kind: "voice",
    label: "Learn your voice",
    trigger,
    tools: readOnly(),
    prompt: `Learn how the user writes, so every message MeatDeck drafts for them sounds like them, not like an assistant.

1. Read their own messages with the messaging integration's "List my messages" action (see the integrations block): 2 or 3 searches for messages FROM the user over the last ~60 days, covering DMs and a couple of busy channels. Aim for about 80 to 150 messages, favouring ones where they ask, nudge, reply or decline, since that's what MeatDeck drafts.
2. Combine them with the inputs below: their GitHub comments, and above all "editsToDrafts" (your draft next to what they actually sent). The edits show exactly what you get wrong.
3. Call set_voice with:
   - guide: about 120 to 200 words of concrete, imperative rules. Cover: language(s) and when each is used (e.g. their native language with some colleagues in DMs, English in channels or PRs, mixed?); length; greeting and sign-off habits; capitalisation and punctuation; emoji; directness and how they ask for things or nudge; phrases they actually use; things they never do (e.g. "no 'just following up'", "no exclamation marks"). Be specific, not generic.
   - examples: 5 to 8 of their real messages, verbatim and short, that best show the voice in asks, nudges and replies. Mix the languages they use.
   - sources: { slack: how many of their Slack messages you read, github: how many githubComments were given, edits: how many editsToDrafts }.
If a current profile exists, refine it instead of starting over, and keep what's still true.
Reply in one line: the 3 most distinctive traits.`,
  };
}

// ---------- integrations ----------

/** Tools/how for fetching a project from the issue tracker integration (Linear by default). */
function projectTools(): string[] {
  const p = provider("issues", "getProject");
  const impl = p?.actions.getProject;
  return impl?.kind === "claude" ? impl.tools : [];
}
function projectHow(): string {
  const p = provider("issues", "getProject");
  const impl = p?.actions.getProject;
  if (!p || !impl) return "no issue tracker integration can do this; skip";
  return impl.kind === "claude"
    ? impl.how
    : `run_integration_action(integration "${p.id}", action "getProject", input {name})`;
}
