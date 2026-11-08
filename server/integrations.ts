// Runs integration actions, whatever the driver: MeatDeck's own code (built-in), a CLI command,
// an HTTP request (tokens from the macOS Keychain), or a narrow Claude run with a connector.
// Also: status checks (plain code, cached) and the prompt block that tells Claude which tool does what.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  actionSpec,
  CATEGORIES,
  categoryOf,
  type ActionImpl,
  type CategoryId,
  type Integration,
  type IntegrationStatus,
} from "../shared/integrations.ts";
import { github, mergePr, rerunFailed } from "./github.ts";
import { resolveBin } from "./shellEnv.ts";
import { store } from "./store/store.ts";

const run = promisify(execFile);

export type ActionResult = { ok: true; output: unknown } | { ok: false; error: string };

// ---------- built-in (GitHub via gh) ----------

const BUILTIN: Record<string, (input: Record<string, string>) => Promise<unknown>> = {
  "github.listMyPullRequests": async () => github.mine,
  "github.listReviewRequests": async () => github.reviewRequests,
  "github.getPullRequestState": async ({ url }) =>
    (
      await run(resolveBin("gh"), ["pr", "view", url, "--json", "state", "-q", ".state"], { timeout: 20_000 })
    ).stdout.trim(),
  "github.readPullRequestComments": async ({ url }) =>
    (
      await run(resolveBin("gh"), ["pr", "view", url, "--comments"], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 })
    ).stdout.slice(-12_000),
  "github.mergePullRequest": async ({ url }) => {
    const r = await mergePr(url);
    if (!r.ok) throw new Error(r.error);
    return `Merged (${r.method})`;
  },
  "github.rerunFailedChecks": async ({ url }) => {
    const r = await rerunFailed(url);
    if (!r.ok) throw new Error(r.error);
    return `Re-running ${r.runs} workflow run${r.runs === 1 ? "" : "s"}`;
  },
  "github.commentOnPullRequest": async ({ url, body }) => {
    const kind = /\/issues\//.test(url) ? "issue" : "pr";
    await run(resolveBin("gh"), [kind, "comment", url, "--body", body], { timeout: 30_000 });
    return "Commented";
  },
  "github.listMyComments": async () => {
    const { stdout } = await run(
      resolveBin("gh"),
      [
        "api",
        "graphql",
        "-f",
        "query=query{viewer{issueComments(last:40){nodes{body}}}}",
        "-q",
        ".data.viewer.issueComments.nodes[].body",
      ],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 15 && !l.startsWith("<!--") && !l.startsWith("|"))
      .slice(-25);
  },
};

// ---------- secrets (macOS Keychain; never written to MeatDeck's files) ----------

const SERVICE = "is.sag.meatdeck";
/** The app id before the public release. Secrets saved under it move to SERVICE the first time they're read. */
const LEGACY_SERVICE = "dev.slops.meatdeck";
const security = (args: string[]) => run("/usr/bin/security", args, { timeout: 10_000 });

export async function setSecret(name: string, value: string) {
  await security(["add-generic-password", "-a", name, "-s", SERVICE, "-w", value, "-U"]);
}
async function readSecret(name: string, service: string): Promise<string | undefined> {
  try {
    const { stdout } = await security(["find-generic-password", "-a", name, "-s", service, "-w"]);
    return stdout.replace(/\n$/, "");
  } catch {
    return undefined;
  }
}
async function findSecret(name: string): Promise<string | undefined> {
  const value = await readSecret(name, SERVICE);
  if (value !== undefined) return value;
  const legacy = await readSecret(name, LEGACY_SERVICE);
  if (legacy === undefined) return undefined;
  await setSecret(name, legacy);
  await security(["delete-generic-password", "-a", name, "-s", LEGACY_SERVICE]).catch(() => {});
  return legacy;
}
async function hasSecret(name: string): Promise<boolean> {
  return (await findSecret(name)) !== undefined;
}
async function getSecret(name: string): Promise<string> {
  const value = await findSecret(name);
  if (value === undefined) throw new Error(`Secret "${name}" isn't in the Keychain. Add it on the integration's page.`);
  return value;
}

// ---------- templates ----------

const shellQuote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
function render(template: string, input: Record<string, string>, quote: (v: string) => string) {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) =>
    k.startsWith("secret:") ? `{{${k}}}` : quote(input[k] ?? ""),
  );
}
async function fillSecrets(text: string) {
  const names = [...text.matchAll(/\{\{secret:([\w.-]+)\}\}/g)].map((m) => m[1]);
  for (const n of new Set(names)) text = text.replaceAll(`{{secret:${n}}}`, await getSecret(n));
  return text;
}
const pick = (data: unknown, path?: string) =>
  path
    ? path
        .split(".")
        .reduce<unknown>(
          (v, k) =>
            v == null ? v : Array.isArray(v) && /^\d+$/.test(k) ? v[Number(k)] : (v as Record<string, unknown>)[k],
          data,
        )
    : data;

// ---------- running an action ----------

/** Claude-driver actions are run by a narrow Claude job; claude/runQueue.ts registers the runner (avoids an import cycle). */
let claudeRunner: ((i: Integration, actionId: string, input: Record<string, string>) => Promise<string>) | undefined;
export function setClaudeActionRunner(fn: typeof claudeRunner) {
  claudeRunner = fn;
}

export async function runAction(
  integrationId: string,
  actionId: string,
  input: Record<string, string> = {},
): Promise<ActionResult> {
  const i = store.integration(integrationId);
  if (!i) return { ok: false, error: `No integration "${integrationId}"` };
  if (!i.enabled) return { ok: false, error: `${i.name} is turned off` };
  const impl = i.actions[actionId];
  if (!actionSpec(i.category, actionId))
    return { ok: false, error: `${categoryOf(i.category).label} has no action "${actionId}"` };
  if (!impl || impl.kind === "none") return { ok: false, error: `${i.name} doesn't implement ${actionId}` };
  try {
    return { ok: true, output: await perform(i, actionId, impl, input) };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    return { ok: false, error: (e.stderr || e.message || String(err)).trim().slice(0, 800) };
  }
}

async function perform(
  i: Integration,
  actionId: string,
  impl: ActionImpl,
  input: Record<string, string>,
): Promise<unknown> {
  switch (impl.kind) {
    case "builtin": {
      const fn = BUILTIN[`${i.id}.${actionId}`];
      if (!fn) throw new Error("No built-in implementation");
      return fn(input);
    }
    case "cli": {
      const cmd = await fillSecrets(render(impl.command, input, shellQuote));
      const shell = process.env.SHELL || "/bin/zsh";
      const { stdout } = await run(shell, ["-lc", cmd], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024 });
      return impl.output === "json" ? JSON.parse(stdout) : stdout.trim();
    }
    case "http": {
      const url = await fillSecrets(render(impl.url, input, encodeURIComponent));
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(impl.headers ?? {}))
        headers[k] = await fillSecrets(render(v, input, (x) => x));
      const body = impl.body
        ? await fillSecrets(render(impl.body, input, (x) => JSON.stringify(x).slice(1, -1)))
        : undefined;
      const res = await fetch(url, { method: impl.method, headers, body, signal: AbortSignal.timeout(60_000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
      return impl.output === "json" ? pick(JSON.parse(text), impl.pick) : text;
    }
    case "claude": {
      if (!claudeRunner) throw new Error("Claude runner not ready");
      return claudeRunner(i, actionId, input);
    }
    default:
      throw new Error("Not implemented");
  }
}

// ---------- which integration handles what ----------

export function enabledIn(cat: CategoryId): Integration[] {
  return store.integrations().filter((i) => i.enabled && i.category === cat);
}

/** First enabled integration in the category that implements the action. */
export function provider(cat: CategoryId, actionId: string): Integration | undefined {
  return enabledIn(cat).find((i) => i.actions[actionId] && i.actions[actionId].kind !== "none");
}

/** Which integration a draft goes out through, by its channel. */
export function senderFor(channel: string): { integration: Integration; action: string } | undefined {
  const direct = store.integration(channel);
  if (direct?.enabled) {
    const action =
      direct.category === "code"
        ? "commentOnPullRequest"
        : direct.category === "issues"
          ? "commentOnIssue"
          : "sendMessage";
    if (direct.actions[action] && direct.actions[action].kind !== "none") return { integration: direct, action };
  }
  if (channel === "github") {
    const p = provider("code", "commentOnPullRequest");
    return p && { integration: p, action: "commentOnPullRequest" };
  }
  if (channel === "linear") {
    const p = provider("issues", "commentOnIssue");
    return p && { integration: p, action: "commentOnIssue" };
  }
  const p = provider("messaging", "sendMessage");
  return p && { integration: p, action: "sendMessage" };
}

/** Allowlist entries the enabled Claude-driver integrations need for a mode. */
export function integrationTools(mode: "read" | "write" | "all"): string[] {
  const out = new Set<string>();
  for (const i of store.integrations()) {
    if (!i.enabled) continue;
    for (const spec of categoryOf(i.category).actions) {
      if (mode !== "all" && spec.mode !== mode) continue;
      const impl = i.actions[spec.id];
      if (impl?.kind === "claude") impl.tools.forEach((t) => out.add(t));
    }
  }
  return [...out];
}

/** Whole MCP servers behind the enabled Claude integrations (chat is fully capable). */
export function integrationServers(): string[] {
  const out = new Set<string>();
  for (const t of integrationTools("all"))
    if (t.startsWith("mcp__")) out.add(t.lastIndexOf("__") > 4 ? t.slice(0, t.lastIndexOf("__")) : t);
  return [...out];
}

/** Tells Claude which service handles each kind of work, and exactly how. Goes into every run. */
export function integrationsBlock(mode: "read" | "all"): string {
  const sections: string[] = [];
  for (const cat of CATEGORIES) {
    for (const i of enabledIn(cat.id)) {
      const lines: string[] = [];
      for (const spec of cat.actions) {
        if (mode === "read" && spec.mode !== "read") continue;
        const impl = i.actions[spec.id];
        if (!impl || impl.kind === "none") continue;
        if (impl.kind === "claude") lines.push(`- ${spec.label}: ${impl.how}`);
        else if (
          i.category !== "code" ||
          ["readPullRequestComments", "listMyComments"].includes(spec.id) ||
          mode === "all"
        )
          lines.push(
            `- ${spec.label}: run_integration_action(integration "${i.id}", action "${spec.id}"${spec.inputs.length ? `, input {${spec.inputs.map((x) => x.name).join(", ")}}` : ""})`,
          );
      }
      if (lines.length) sections.push(`${cat.label} · ${i.name}:\n${lines.join("\n")}`);
    }
  }
  if (!sections.length) return "";
  return `\n\nThe user's integrations: this is how to reach each kind of service. Use exactly these; if a category isn't listed, the user doesn't have that service connected.\n${sections.join("\n")}`;
}

// ---------- status (plain code, cached) ----------

let mcpCache: { at: number; list: { name: string; state: string }[] } | undefined;
export async function mcpServers(force = false): Promise<{ name: string; state: string }[]> {
  if (!force && mcpCache && Date.now() - mcpCache.at < 10 * 60_000) return mcpCache.list;
  try {
    const { stdout } = await run(resolveBin("claude"), ["mcp", "list"], {
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const list = stdout
      .split("\n")
      .map((l) => /^(.+?):\s.*-\s(✔|✓|!|✗|×)\s*(.*)$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => ({
        name: m[1].trim(),
        state: m[2] === "✔" || m[2] === "✓" ? "connected" : m[2] === "!" ? "needs auth" : "failed",
      }));
    mcpCache = { at: Date.now(), list };
    return list;
  } catch {
    return mcpCache?.list ?? [];
  }
}

const statusCache = new Map<string, { at: number; s: IntegrationStatus }>();
export async function statusOf(i: Integration, force = false): Promise<IntegrationStatus> {
  if (!i.enabled) return { state: "off", text: "Turned off" };
  const cached = statusCache.get(i.id);
  if (!force && cached && Date.now() - cached.at < 5 * 60_000) return cached.s;
  let s: IntegrationStatus;
  try {
    if (i.driver === "builtin" && i.id === "github") {
      s = github.error
        ? { state: "error", text: "gh can't reach GitHub" }
        : github.login
          ? { state: "ok", text: `Signed in as ${github.login}` }
          : { state: "warning", text: "Checking gh…" };
    } else if (i.driver === "cli") {
      const first = Object.values(i.actions).find((a) => a.kind === "cli") as
        | Extract<ActionImpl, { kind: "cli" }>
        | undefined;
      const bin = first?.command.trim().split(/\s+/)[0];
      if (!bin) s = { state: "warning", text: "No commands yet" };
      else {
        const path = resolveBin(bin);
        s = path.includes("/")
          ? { state: "ok", text: `Uses ${bin}` }
          : { state: "error", text: `${bin} not found on PATH` };
      }
    } else if (i.driver === "http") {
      const missing: string[] = [];
      for (const n of i.secrets ?? []) if (!(await hasSecret(n))) missing.push(n);
      s = missing.length ? { state: "warning", text: `Set ${missing.join(", ")}` } : { state: "ok", text: "Ready" };
    } else if (i.driver === "claude") {
      const servers = await mcpServers(force);
      const m = servers.find((x) => x.name.toLowerCase() === (i.mcpServer ?? "").toLowerCase());
      s = !m
        ? { state: "error", text: `${i.mcpServer ?? "Connector"} isn't set up in Claude Code` }
        : m.state === "connected"
          ? { state: "ok", text: "Connected through Claude" }
          : m.state === "needs auth"
            ? { state: "warning", text: "Needs authorization in claude.ai connectors" }
            : { state: "error", text: "Connector failed to connect" };
    } else s = { state: "ok", text: "Ready" };
  } catch (err) {
    s = { state: "error", text: (err as Error).message.slice(0, 120) };
  }
  statusCache.set(i.id, { at: Date.now(), s });
  return s;
}

export function cachedStatus(i: Integration): IntegrationStatus {
  if (!i.enabled) return { state: "off", text: "Turned off" };
  return statusCache.get(i.id)?.s ?? { state: "warning", text: "Checking…" };
}
