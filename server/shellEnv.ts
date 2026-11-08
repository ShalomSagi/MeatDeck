import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Apps launched from Finder/launchd get a bare PATH. Like T3 Code's
// DesktopShellEnvironment, ask a login+interactive shell for the real one once.
let resolved = false;
export function loadLoginShellPath() {
  if (resolved) return;
  resolved = true;
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const out = execFileSync(shell, ["-lic", 'printf "__PATH__%s__END__" "$PATH"'], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const path = /__PATH__(.*)__END__/.exec(out)?.[1];
    if (path) process.env.PATH = path;
  } catch {
    // keep the inherited PATH
  }
}

const cache = new Map<string, string>();
export function resolveBin(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;
  loadLoginShellPath();
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = join(dir, name);
    if (dir && existsSync(candidate)) {
      cache.set(name, candidate);
      return candidate;
    }
  }
  return name;
}
