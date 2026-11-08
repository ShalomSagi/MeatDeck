// Source fingerprint for updates: a hash per source file. The build records it next to the bundle
// (dist-electron/build.json); the running app compares it with the source folder to know whether a
// newer build is available. Plain file hashing, no git needed.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** What goes into a build. Anything else (docs, release/, node_modules) doesn't make it stale. */
const DIRS = ["server", "shared", "web/src", "web/index.html", "mcp", "desktop", "skill", "build"];
const FILES = ["package.json", "pnpm-lock.yaml", "vite.config.ts", "scripts/build-desktop.mjs"];
const SKIP = new Set(["node_modules", ".DS_Store"]);

function walk(root: string, path: string, out: string[]) {
  const full = join(root, path);
  if (!existsSync(full)) return;
  if (statSync(full).isFile()) return void out.push(path);
  for (const name of readdirSync(full)) if (!SKIP.has(name)) walk(root, join(path, name), out);
}

export type Manifest = Record<string, string>;

export function sourceManifest(root: string): Manifest {
  const files: string[] = [];
  for (const d of [...DIRS, ...FILES]) walk(root, d, files);
  const out: Manifest = {};
  for (const f of files.sort())
    out[relative(root, join(root, f))] = createHash("sha1")
      .update(readFileSync(join(root, f)))
      .digest("hex")
      .slice(0, 12);
  return out;
}

export function manifestHash(m: Manifest): string {
  return createHash("sha1").update(JSON.stringify(m)).digest("hex").slice(0, 12);
}

/** Files added, removed or changed since `built`. */
export function changedFiles(built: Manifest, now: Manifest): string[] {
  const all = new Set([...Object.keys(built), ...Object.keys(now)]);
  return [...all].filter((f) => built[f] !== now[f]).sort();
}

/** Semver-ish compare: 1.2.0 > 1.2.0-beta > 1.2.0-alpha; numeric parts compared as numbers. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [main, pre] = v.replace(/^v/, "").split("-", 2);
    return { nums: main.split(".").map((n) => Number(n) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1; // a release beats its pre-releases
  if (!y.pre) return -1;
  return x.pre.localeCompare(y.pre, undefined, { numeric: true });
}

/**
 * What a build knows about where its updates come from:
 * - "source": built on this Mac from a source folder (scripts/install.sh); updates rebuild from it.
 * - "release": downloaded from GitHub Releases (scripts/release.sh); updates come from there.
 */
export type BuildInfo =
  | { channel?: "source"; version: string; builtAt: string; repo: string; hash: string; manifest: Manifest }
  | {
      channel: "release";
      version: string;
      builtAt: string;
      github: string;
      /** Test-only stand-in for https://api.github.com. */ api?: string;
    };
