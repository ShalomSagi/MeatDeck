// The run queue: one `claude -p` at a time, with logs, usage and limits read from its stream.
// Also runs Claude-driver integration actions called from code (setClaudeActionRunner).
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeRun, Message, RunKind, RunUsage } from "../../shared/types.ts";
import { actionSpec, type Integration } from "../../shared/integrations.ts";
import { integrationsBlock, setClaudeActionRunner } from "../integrations.ts";
import { resolveBin } from "../shellEnv.ts";
import { DATA_DIR } from "../store/persistence.ts";
import { store } from "../store/store.ts";
import { FILE_WRITES, permissionArgs, runEnv, withAlwaysAllowed } from "./allowlists.ts";
import { jobFor, sendJob, type Job } from "./jobs.ts";
import { contextFor, rulesBlock } from "./runContext.ts";
import { describeEvent, recordLimits, toRunUsage, tryJson } from "./streamEvents.ts";

const RUNS_DIR = join(DATA_DIR, "runs");
mkdirSync(RUNS_DIR, { recursive: true });
const RUN_TIMEOUT_MS = 20 * 60_000;

const UNATTENDED = `You are running unattended inside the MeatDeck app (scheduled or button-triggered \`claude -p\`). Nobody will read questions or answer them, so never ask; decide, and record what you were unsure about in the dashboard (brief highlights or todo notes). Write every result into the dashboard through the meatdeck MCP tools. Keep your final chat message to 1-3 short lines summarising what changed.`;

// ---------- queue ----------

export const runs = new EventEmitter();
export let currentRun: ClaudeRun | undefined;
const queue: Job[] = [];

export function enqueue(
  kindOrJob: Exclude<RunKind, "send" | "project" | "revise" | "voice" | "linear"> | Job,
  trigger: ClaudeRun["trigger"] = "you",
): boolean {
  const job = typeof kindOrJob === "string" ? jobFor(kindOrJob, trigger) : kindOrJob;
  const busy = (k: RunKind) => currentRun?.status === "running" && currentRun.kind === k;
  // One of each read kind at a time (per project for discovery); a manual run supersedes a queued morning/pulse.
  if (job.kind === "revise") {
    if (queue.some((q) => q.target === job.target)) return false;
  } else if (job.kind === "project") {
    if (queue.some((q) => q.projectId === job.projectId) || (busy("project") && currentRun?.label === job.label))
      return false;
  } else if (job.kind !== "send" && (busy(job.kind) || queue.some((q) => q.kind === job.kind))) return false;
  if (job.kind === "manual" || job.kind === "morning") {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === "pulse") queue.splice(i, 1);
    if (busy("manual") || busy("morning")) return false;
  }
  queue.push(job);
  void drain();
  runs.emit("change");
  return true;
}

export function sendMessages(messages: Message[]) {
  for (const m of messages) store.updateMessage(m.id, { status: "approved", text: m.text });
  return enqueue(sendJob(messages));
}

export function queued() {
  return queue.map((q) => ({ kind: q.kind, label: q.label, target: q.target }));
}

export function runLog(id: string): string | undefined {
  if (currentRun?.id === id) return currentRun.log;
  try {
    return readFileSync(join(RUNS_DIR, `${id}.log`), "utf8");
  } catch {
    return undefined;
  }
}

let draining = false;
async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      await execute(job, await contextFor(job));
    }
  } finally {
    draining = false;
  }
}

function summaryOf(run: ClaudeRun): Omit<ClaudeRun, "log"> {
  const { log: _log, ...rest } = run;
  return rest;
}

function execute(job: Job, extraContext: string): Promise<void> {
  return new Promise((resolve) => {
    const run: ClaudeRun = {
      id: randomUUID().slice(0, 8),
      kind: job.kind,
      label: job.label,
      trigger: job.trigger,
      startedAt: new Date().toISOString(),
      status: "running",
      log: "",
      ...(job.target ? { target: job.target, instruction: job.instruction } : {}),
    };
    currentRun = run;
    store.recordRun(summaryOf(run));

    let lastText = "";
    let sessionId: string | undefined;
    let usage: RunUsage | undefined;
    const append = (line: string) => {
      run.log += line.endsWith("\n") ? line : `${line}\n`;
      if (run.log.length > 300_000) run.log = run.log.slice(-300_000);
      runs.emit("change");
    };

    const finish = (ok: boolean, note?: string) => {
      if (run.finishedAt) return;
      clearTimeout(timer);
      run.status = ok ? "done" : "failed";
      run.finishedAt = new Date().toISOString();
      run.summary = (note ?? lastText)
        .split("\n")
        .find((l) => l.trim())
        ?.slice(0, 240);
      if (usage) run.usage = usage;
      append(ok ? "— finished" : `— failed${note ? `: ${note}` : ""}`);
      writeFileSync(join(RUNS_DIR, `${run.id}.log`), run.log);
      store.recordRun(summaryOf(run));
      job.onDone?.(ok, run, lastText);
      runs.emit("finished", run);
      resolve();
    };

    const args = [
      "-p",
      job.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--append-system-prompt",
      UNATTENDED + rulesBlock() + integrationsBlock(job.kind === "send" ? "all" : "read") + extraContext,
      "--allowedTools",
      withAlwaysAllowed(job.tools).join(","),
      "--disallowedTools",
      FILE_WRITES.join(","),
      // Runs you started can ask you for a tool instead of failing; scheduled runs never wait on you.
      ...(job.trigger === "you" ? permissionArgs() : []),
    ];
    const settings = store.settings();
    const model = job.model ?? (job.kind === "pulse" ? settings.pulseModel || settings.model : settings.model);
    if (model) args.push("--model", model);

    let child;
    try {
      child = spawn(resolveBin("claude"), args, {
        cwd: DATA_DIR,
        env: runEnv(job.label, undefined, job.kind === "send"),
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      return finish(false, `could not start claude: ${(err as Error).message}`);
    }
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(false, "timed out after 20 minutes");
    }, RUN_TIMEOUT_MS);

    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        // Usage + limits ride along in the stream we already read: no extra calls, no tokens.
        if (line.includes('"type":"system"') && line.includes('"init"'))
          sessionId = tryJson(line)?.session_id ?? sessionId;
        if (line.includes('"rate_limit_event"')) recordLimits(tryJson(line)?.rate_limit_info);
        if (line.includes('"type":"result"')) usage = toRunUsage(tryJson(line), sessionId) ?? usage;
        if (line.includes('"rate_limit_event"')) continue;
        const text = describeEvent(line, append);
        if (text) lastText = text;
      }
    });
    child.stderr.on("data", (chunk: Buffer) => append(chunk.toString()));
    child.on("error", (err) => finish(false, err.message));
    child.on("close", (code) => finish(code === 0, code === 0 ? undefined : `exit code ${code}`));
    runs.emit("change");
  });
}

/** A Claude-driver action called from code: one narrow run with only that action's tools. */
setClaudeActionRunner(
  (i: Integration, actionId: string, input: Record<string, string>) =>
    new Promise<string>((resolve, reject) => {
      const impl = i.actions[actionId];
      const spec = actionSpec(i.category, actionId);
      if (impl?.kind !== "claude" || !spec) return reject(new Error("not a Claude action"));
      const accepted = enqueue({
        kind: "revise",
        label: `${i.name} · ${spec.label}`,
        target: `integration:${i.id}:${actionId}:${Date.now()}`,
        trigger: "you",
        tools: ["ToolSearch", ...impl.tools],
        model: store.settings().pulseModel || undefined,
        prompt: `Perform this ${i.name} action and return only its result.
Action: ${spec.label}: ${spec.description}
How: ${impl.how}
Input: ${JSON.stringify(input)}
Return: ${spec.returns}. Reply with the result only, no commentary.${spec.mode === "write" ? " This is a write action the user asked for: do it exactly once." : " Read only: change nothing."}`,
        onDone: (ok, _run, text) => (ok ? resolve(text) : reject(new Error(text || "Claude run failed"))),
      });
      if (!accepted) reject(new Error("Couldn't queue the run"));
    }),
);
