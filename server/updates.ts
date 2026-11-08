// Updates, T3 style: a small ↑ button appears when a newer build is ready; click → restart into it.
// Two channels, picked by how this build was made (dist-electron/build.json, scripts/build-desktop.mjs):
//
// - "source": built on this Mac from a source folder (scripts/install.sh). "An update" = the source
//   changed since this build: code compares file hashes every few minutes, no tokens. Applying runs
//   install.sh, which rebuilds, swaps the app and relaunches; a failed build leaves the app as is.
// - "release": installed from GitHub Releases (scripts/release.sh). Code asks GitHub's public API for
//   the latest release a few times a day (no token needed for a public repo). Applying downloads the
//   zip, checks its SHA-256 against latest.json, checks the code signature (same Apple team as the
//   running app when it's Developer ID signed), then a detached script swaps the app and relaunches.
//
// Both relaunch without ELECTRON_RUN_AS_NODE (this backend runs with it; `open` would hand it to the
// new app, which would then start as plain Node and exit), and only after the old app and backend
// are gone (Electron's single-instance lock would make the new app exit at once).
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { changedFiles, compareVersions, manifestHash, sourceManifest, type BuildInfo } from "../shared/fingerprint.ts";
import type { UpdateStatus } from "../shared/types.ts";
import { DATA_DIR } from "./store/persistence.ts";

const run = promisify(execFile);
export const updateEvents = new EventEmitter();
const LOG = join(DATA_DIR, "update.log");
const DOWNLOADS = join(DATA_DIR, "updates");

const build: BuildInfo | undefined = (() => {
  try {
    return JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "build.json"), "utf8")) as BuildInfo;
  } catch {
    return undefined; // `pnpm dev` / running from source: nothing to update
  }
})();

/** The .app this backend runs from (…/X.app/Contents/MacOS/X), if it's a packaged app. */
const APP_PATH = /^(.*\.app)\/Contents\/MacOS\//.exec(process.execPath)?.[1];

let status: UpdateStatus = !build
  ? { state: "unsupported", changed: [], message: "Running from source (pnpm dev): restart it to pick up changes." }
  : build.channel === "release"
    ? {
        state: "current",
        channel: "release",
        version: build.version,
        builtAt: build.builtAt,
        github: build.github,
        changed: [],
      }
    : {
        state: "current",
        channel: "source",
        version: build.version,
        builtAt: build.builtAt,
        repo: build.repo,
        changed: [],
      };

function set(next: Partial<UpdateStatus>) {
  status = { ...status, ...next };
  updateEvents.emit("change");
}

export const updateStatus = () => status;

/** Env for the update scripts: ours minus what would make the relaunched app start as plain Node. */
function cleanEnv(): NodeJS.ProcessEnv {
  const {
    ELECTRON_RUN_AS_NODE: _n,
    PORT: _p,
    MEATDECK_DIST: _d,
    MEATDECK_RUN: _r,
    MEATDECK_CHAT: _c,
    MEATDECK_WRITE: _w,
    ...env
  } = process.env;
  return env;
}

// ---------- source channel ----------

function checkSource(b: Extract<BuildInfo, { repo: string }>) {
  if (!existsSync(join(b.repo, "package.json"))) {
    set({
      state: "error",
      message: `The source folder ${b.repo} is gone, so there's nothing to update from.`,
      checkedAt: new Date().toISOString(),
    });
    return;
  }
  const now = sourceManifest(b.repo);
  const changed = manifestHash(now) === b.hash ? [] : changedFiles(b.manifest, now);
  // A failed build stays "failed" until the source changes again (the next fix).
  const sameAsFailed = status.state === "failed" && status.failedHash === manifestHash(now);
  set({
    state: sameAsFailed ? "failed" : changed.length ? "available" : "current",
    changed,
    checkedAt: new Date().toISOString(),
    ...(sameAsFailed ? {} : { message: undefined }),
  });
}

function applySource(b: Extract<BuildInfo, { repo: string }>) {
  const script = join(b.repo, "scripts", "install.sh");
  if (!existsSync(script)) return set({ state: "error", message: `No install script at ${script}.` });
  const hash = manifestHash(sourceManifest(b.repo));
  const fd = openSync(LOG, "w");
  // Detached: install.sh quits this app (and this server) before swapping it, so it must outlive us.
  const child = spawn("/bin/zsh", [script], {
    cwd: b.repo,
    detached: true,
    stdio: ["ignore", fd, fd],
    env: cleanEnv(),
  });
  closeSync(fd);
  child.unref();
  set({ state: "updating", progress: "Building…", startedAt: new Date().toISOString(), message: undefined });
  // Still alive when it exits = the build failed before the swap (success quits this app).
  child.on(
    "exit",
    (code) =>
      code !== 0 &&
      set({
        state: "failed",
        failedHash: hash,
        progress: undefined,
        message: `The build failed (exit ${code}). The app you're using is unchanged.\n${logExcerpt()}`,
      }),
  );
}

function logExcerpt(): string {
  try {
    // Start at the first error line (the end of the log is usually a stack trace), else the tail.
    const lines = readFileSync(LOG, "utf8").trim().split("\n");
    const first = lines.findIndex((l) => /error|✘|ERR_|failed/i.test(l) && !/^\s+at /.test(l));
    return (first >= 0 ? lines.slice(first, first + 12) : lines.slice(-12)).join("\n");
  } catch {
    return "";
  }
}

// ---------- release channel (GitHub Releases) ----------

/** What scripts/release.sh publishes as latest.json next to the zip. */
interface ReleaseManifest {
  version: string;
  notes?: string;
  zip: { name: string; sha256: string; size: number };
}

let release: { manifest: ReleaseManifest; zipUrl: string; pageUrl: string } | undefined;

const gh = (url: string) =>
  fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": `MeatDeck/${build?.version ?? "dev"}` },
    signal: AbortSignal.timeout(20_000),
  });

async function checkRelease(b: Extract<BuildInfo, { channel: "release" }>) {
  const res = await gh(`${b.api ?? "https://api.github.com"}/repos/${b.github}/releases/latest`);
  if (res.status === 404)
    return set({ state: "current", checkedAt: new Date().toISOString(), message: "No releases published yet." });
  if (!res.ok)
    throw new Error(`GitHub answered ${res.status}${res.status === 403 ? " (rate limited, will retry later)" : ""}`);
  const r = (await res.json()) as {
    tag_name: string;
    html_url: string;
    body?: string;
    assets: { name: string; browser_download_url: string }[];
  };
  const manifestAsset = r.assets.find((a) => a.name === "latest.json");
  if (!manifestAsset) throw new Error(`Release ${r.tag_name} has no latest.json`);
  const m = (await (await gh(manifestAsset.browser_download_url)).json()) as ReleaseManifest;
  const zip = r.assets.find((a) => a.name === m.zip.name);
  if (!zip) throw new Error(`Release ${r.tag_name} is missing ${m.zip.name}`);
  release = { manifest: m, zipUrl: zip.browser_download_url, pageUrl: r.html_url };
  const newer = compareVersions(m.version, b.version) > 0;
  set({
    state: newer ? (status.state === "failed" && status.latest === m.version ? "failed" : "available") : "current",
    latest: m.version,
    notes: (m.notes ?? r.body ?? "").slice(0, 4000) || undefined,
    releaseUrl: r.html_url,
    changed: [],
    checkedAt: new Date().toISOString(),
    ...(newer && status.state === "failed" ? {} : { message: undefined }),
  });
}

/** Team ID of a signed app, or undefined for ad-hoc/unsigned. */
async function teamId(app: string): Promise<string | undefined> {
  try {
    const { stderr } = await run("/usr/bin/codesign", ["-dv", app]);
    const t = /TeamIdentifier=(\S+)/.exec(stderr)?.[1];
    return t && t !== "not" ? t : undefined;
  } catch {
    return undefined;
  }
}

async function applyRelease() {
  if (!release) await checkRelease(build as Extract<BuildInfo, { channel: "release" }>);
  if (!release || !APP_PATH)
    throw new Error(APP_PATH ? "No release to install." : "Can't tell where this app is installed.");
  const { manifest, zipUrl } = release;
  set({
    state: "updating",
    progress: `Downloading ${manifest.version}…`,
    startedAt: new Date().toISOString(),
    message: undefined,
  });
  rmSync(DOWNLOADS, { recursive: true, force: true });
  mkdirSync(DOWNLOADS, { recursive: true });
  const zipPath = join(DOWNLOADS, manifest.zip.name);

  // Download (redirects to GitHub's CDN) and hash as it streams.
  const res = await fetch(zipUrl, {
    headers: { "User-Agent": `MeatDeck/${build?.version}` },
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}).`);
  const hash = createHash("sha256");
  const body = Readable.fromWeb(res.body as WebReadableStream);
  body.on("data", (c: Buffer) => hash.update(c));
  await pipeline(body, createWriteStream(zipPath));
  const sha = hash.digest("hex");
  if (sha !== manifest.zip.sha256)
    throw new Error(
      `The download doesn't match its checksum (expected ${manifest.zip.sha256.slice(0, 12)}…, got ${sha.slice(0, 12)}…). Nothing was changed.`,
    );

  set({ progress: "Checking the new version…" });
  const unpacked = join(DOWNLOADS, "app");
  await run("/usr/bin/ditto", ["-x", "-k", zipPath, unpacked]);
  const newApp = join(unpacked, APP_PATH.split("/").pop()!);
  if (!existsSync(newApp)) throw new Error(`The zip doesn't contain ${APP_PATH.split("/").pop()}.`);
  await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", newApp]).catch(() => {
    throw new Error("The new version's code signature is invalid. Nothing was changed.");
  });
  // A Developer ID signed app only accepts an update signed by the same Apple team.
  const ours = await teamId(APP_PATH);
  if (ours && (await teamId(newApp)) !== ours)
    throw new Error(`The new version isn't signed by the same developer (team ${ours}). Nothing was changed.`);

  set({ progress: "Restarting…" });
  // Detached swap: stop the app (main = our parent) and this backend, wait for both to exit,
  // replace the bundle (keeping the old one until the new one is in place), relaunch.
  const script = join(DOWNLOADS, "swap.sh");
  writeFileSync(
    script,
    `#!/bin/zsh
set -u
APP=${JSON.stringify(APP_PATH)}
NEW=${JSON.stringify(newApp)}
kill -TERM ${process.ppid} ${process.pid} 2>/dev/null
for _ in {1..40}; do kill -0 ${process.ppid} 2>/dev/null || kill -0 ${process.pid} 2>/dev/null || break; sleep 0.5; done
kill -KILL ${process.ppid} ${process.pid} 2>/dev/null
rm -rf "$APP.previous"
mv "$APP" "$APP.previous" || exit 1
if ditto "$NEW" "$APP"; then
  xattr -dr com.apple.quarantine "$APP" 2>/dev/null
  rm -rf "$APP.previous"
else
  rm -rf "$APP"; mv "$APP.previous" "$APP"   # put the old one back
fi
env -u ELECTRON_RUN_AS_NODE -u PORT -u MEATDECK_DIST open "$APP"
`,
  );
  const fd = openSync(LOG, "w");
  spawn("/bin/zsh", [script], { detached: true, stdio: ["ignore", fd, fd], env: cleanEnv() }).unref();
  closeSync(fd);
}

// ---------- public API ----------

let checking: Promise<void> | undefined;

export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!build || status.state === "updating") return status;
  if (build.channel !== "release") {
    checkSource(build);
    return status;
  }
  checking ??= checkRelease(build)
    .catch((err) =>
      set({ checkedAt: new Date().toISOString(), message: `Couldn't check for updates: ${(err as Error).message}` }),
    )
    .finally(() => (checking = undefined));
  await checking;
  return status;
}

export function applyUpdate(): UpdateStatus {
  if (!build || status.state === "updating") return status;
  if (build.channel !== "release") applySource(build);
  else
    void applyRelease().catch((err) =>
      set({
        state: "failed",
        progress: undefined,
        message: `${(err as Error).message}\nThe app you're using is unchanged.`,
      }),
    );
  return status;
}

export function startUpdateChecks() {
  if (!build) return;
  const isRelease = build.channel === "release";
  setTimeout(() => void checkForUpdate(), isRelease ? 60_000 : 15_000);
  // Local file hashing is free; GitHub's unauthenticated API allows 60 requests an hour per IP.
  setInterval(() => void checkForUpdate(), isRelease ? 4 * 60 * 60_000 : 5 * 60_000);
}
