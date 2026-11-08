import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveBin } from "./shellEnv.ts";

/**
 * Starts work in T3 Code with T3's own CLI (`t3 thread start`). That always makes a new thread, unlike
 * the t3code:// link, which reuses a thread already linked to the PR. Plain code, no MeatDeck tokens:
 * the agent's run is billed to T3's session like any thread you start yourself.
 */
const run = promisify(execFile);
const T3_HOME = join(homedir(), ".t3");
const t3Bin = () => (existsSync(join(T3_HOME, "bin", "t3")) ? join(T3_HOME, "bin", "t3") : null);
export const t3Available = () => t3Bin() !== null;

// ---- local clones: "owner/name" → folder, found by reading .git/config (no git calls) ----

const ROOTS = ["dev", "code", "src", "projects", "work", "repos", "Developer"]
  .map((d) => join(homedir(), d))
  .concat(["/Users/Shared/dev"]);
let clones: { at: number; map: Map<string, string> } | null = null;

function remoteOf(dir: string): string | null {
  try {
    const cfg = readFileSync(join(dir, ".git", "config"), "utf8");
    const url = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg)?.[1];
    const m = url && /github\.com[:/]([^/]+\/[^/\s]+?)(?:\.git)?$/.exec(url);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function scan(): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (dir: string, depth: number) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === ".git" && e.isDirectory())) {
      const r = remoteOf(dir);
      // Prefer the shortest path (the main clone over nested copies or worktrees).
      if (r && (!map.has(r) || dir.length < map.get(r)!.length)) map.set(r, dir);
      return;
    }
    if (depth === 0) return;
    for (const e of entries)
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") walk(join(dir, e.name), depth - 1);
  };
  for (const root of ROOTS) walk(root, 3);
  return map;
}

function cloneOf(repo: string): string | undefined {
  if (!clones || Date.now() - clones.at > 30 * 60_000) clones = { at: Date.now(), map: scan() };
  let dir = clones.map.get(repo.toLowerCase());
  if (!dir) {
    clones = { at: Date.now(), map: scan() }; // maybe cloned since the last scan
    dir = clones.map.get(repo.toLowerCase());
  }
  return dir;
}

// ---- start ----

export interface StartInT3 {
  url: string; // PR url
  repo: string; // owner/name
  number: number;
  verb: string;
  title: string;
  prompt: string;
}

/** Verbs that change the PR's code: run them in a fresh worktree on the PR's branch. */
const ON_BRANCH = new Set(["fix", "address", "rebase", "review"]);

export async function startInT3(
  input: StartInT3,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const bin = t3Bin();
  if (!bin) return { ok: false, error: "T3 Code's CLI isn't installed (~/.t3/bin/t3)" };
  const dir = cloneOf(input.repo);
  if (!dir)
    return { ok: false, error: `No local clone of ${input.repo} found under ~/dev (add it as a T3 project first)` };
  try {
    const args = [
      "thread",
      "start",
      "--json",
      "--title",
      `${input.title} · ${input.repo.split("/")[1]}#${input.number}`,
    ];
    let prompt = input.prompt;
    if (ON_BRANCH.has(input.verb)) {
      const gh = resolveBin("gh");
      const head = (
        await run(gh, ["pr", "view", input.url, "--json", "headRefName", "-q", ".headRefName"], { timeout: 20_000 })
      ).stdout.trim();
      if (head) {
        await run(resolveBin("git"), ["-C", dir, "fetch", "origin", head], { timeout: 90_000 });
        args.push("--worktree", `origin/${head}`);
        // The worktree already has the PR's code; don't fight over the branch with the main clone.
        prompt = prompt
          .split("\n")
          .map((l) =>
            /gh pr checkout/.test(l)
              ? `${/^\s*\d+\.\s*/.exec(l)?.[0] ?? ""}You're in a fresh worktree at origin/${head} (this PR's head). Push your commits with: git push origin HEAD:${head}`
              : l,
          )
          .join("\n");
        if (input.verb === "review") prompt += `\n\n(This worktree is already at the PR's head, origin/${head}.)`;
      }
    }
    args.push(dir, prompt);
    const { stdout } = await run(bin, args, { timeout: 120_000, cwd: dir });
    const threadId = (JSON.parse(stdout) as { threadId: string }).threadId;
    void openThread(threadId);
    return { ok: true, threadId };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    return { ok: false, error: (e.stderr || e.message).trim().split("\n").slice(-3).join(" ").slice(0, 300) };
  }
}

/** Bring T3 to the front on the new thread (t3code://threads/<environment>/<thread>). */
async function openThread(threadId: string) {
  try {
    const env = readFileSync(join(T3_HOME, "userdata", "environment-id"), "utf8").trim();
    await run("open", [`t3code://threads/${encodeURIComponent(env)}/${encodeURIComponent(threadId)}`], {
      timeout: 10_000,
    });
  } catch {
    // T3 still has the thread; the user can find it in the sidebar.
  }
}
