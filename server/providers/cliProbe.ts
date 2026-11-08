// Probing an agent CLI without spending tokens: run it, or hold a short JSON dialog with it.
import { execFile, spawn } from "node:child_process";
import { PROVIDER_LABEL, type ProviderId, type ProviderStatus } from "../../shared/providers.ts";
import { resolveBin } from "../shellEnv.ts";
import { DATA_DIR } from "../store/persistence.ts";

const PROBE_TIMEOUT_MS = 25_000;
const BIN: Record<ProviderId, string> = { claude: "claude", codex: "codex", cursor: "cursor-agent" };

export function exec(bin: string, args: string[], timeout = 15_000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) =>
    execFile(resolveBin(bin), args, { timeout, cwd: DATA_DIR, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({
        code: !err ? 0 : err.code === "ENOENT" ? -2 : typeof err.code === "number" ? err.code : -1,
        out: `${stdout}${stderr}`,
      }),
    ),
  );
}

// oxlint-disable-next-line no-control-regex -- ANSI color codes in CLI status output start with ESC
export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/[​-‍]/g, "");
const version = (out: string) => /\d+(?:\.\d+)+(?:[-+.\w]*)?/.exec(out)?.[0];

/** Spawn a line-delimited JSON process, write `first`, call onLine until it returns a value. */
export function jsonDialog<L, T>(
  bin: string,
  args: string[],
  first: object[],
  onLine: (j: L, send: (o: object) => void) => T | undefined,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBin(bin), args, { cwd: DATA_DIR, stdio: ["pipe", "pipe", "ignore"] });
    let done = false;
    const end = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill("SIGTERM");
      fn();
    };
    const timer = setTimeout(() => end(() => reject(new Error("timed out"))), PROBE_TIMEOUT_MS);
    const send = (o: object) => child.stdin.write(`${JSON.stringify(o)}\n`);
    let buf = "";
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        let j: L;
        try {
          j = JSON.parse(line);
        } catch {
          continue;
        }
        try {
          const r = onLine(j, send);
          if (r !== undefined) return end(() => resolve(r));
        } catch (err) {
          return end(() => reject(err));
        }
      }
    });
    child.on("error", (err) => end(() => reject(err)));
    child.on("close", () => end(() => reject(new Error("exited before answering"))));
    child.stdin.on("error", () => {});
    for (const o of first) send(o);
  });
}

export function base(id: ProviderId): ProviderStatus {
  return {
    id,
    label: PROVIDER_LABEL[id],
    enabled: true,
    installed: false,
    status: "error",
    auth: { status: "unknown" },
    models: [],
    checkedAt: new Date().toISOString(),
  };
}

export async function versionOf(id: ProviderId, s: ProviderStatus): Promise<boolean> {
  const v = await exec(BIN[id], ["--version"]);
  if (v.code === -2) {
    s.message = `\`${BIN[id]}\` isn't on your PATH.`;
    return false;
  }
  s.installed = true;
  s.version = version(v.out);
  if (v.code !== 0) {
    s.message = `\`${BIN[id]} --version\` failed.`;
    return false;
  }
  return true;
}
