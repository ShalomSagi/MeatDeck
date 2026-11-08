// Electron main process, modelled on T3 Code's apps/desktop:
//  - the backend (server/index.ts, bundled) runs as a child process using
//    Electron's own Node (ELECTRON_RUN_AS_NODE), and the window loads it over HTTP;
//  - frameless window with macOS traffic lights inset into the 52px top bar;
//  - PATH comes from a login shell so `claude` and `gh` resolve from Finder.
// The app keeps running when its window closes so the schedule keeps firing.
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme, shell, screen } from "electron";
import { loadLoginShellPath, resolveBin } from "../server/shellEnv.ts";

const PORT = Number(process.env.PORT ?? 4317);
const ORIGIN = `http://localhost:${PORT}`;
const APP_ROOT = app.getAppPath(); // repo root in dev, Contents/Resources/app when packaged
const SERVER_ENTRY = join(APP_ROOT, "dist-electron", "server.mjs");
const MCP_ENTRY = join(APP_ROOT, "dist-electron", "mcp.mjs");
const TOPBAR_HEIGHT = 52;
const TRAFFIC_LIGHT_RADIUS = 6;

app.setName("MeatDeck");
if (!app.requestSingleInstanceLock()) app.quit();

let win: BrowserWindow | null = null;
let backend: ChildProcess | null = null;
let quitting = false;

// ---------- backend ----------

async function isServing(): Promise<boolean> {
  try {
    const res = await fetch(`${ORIGIN}/api/settings`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

let restarts = 0;
function spawnBackend() {
  backend = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      MEATDECK_DIST: join(APP_ROOT, "dist"),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  backend.on("exit", (code) => {
    backend = null;
    if (quitting) return;
    // Crash: restart with backoff, like T3's DesktopBackendManager.
    const delay = Math.min(30_000, 1000 * 2 ** restarts++);
    console.error(`backend exited (${code}); restarting in ${delay}ms`);
    setTimeout(spawnBackend, delay);
  });
}

async function ensureBackend() {
  // Reuse a server that's already up (`pnpm dev`, or the old LaunchAgent).
  if (await isServing()) return;
  spawnBackend();
  for (let i = 0; i < 100; i++) {
    if (await isServing()) {
      restarts = 0;
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("backend did not start");
}

// ---------- Claude Code wiring (first run) ----------

function run(cmd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) =>
    execFile(cmd, args, { timeout: 30_000, env: process.env }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout}${stderr}` }),
    ),
  );
}

/** Make sure Claude Code has the meatdeck MCP server and the /today skill. */
async function ensureClaudeSetup() {
  const claude = resolveBin("claude");
  if (!existsSync(claude)) return;

  if (app.isPackaged) {
    // Point the user-scope MCP registration at this app's bundled MCP server.
    const current = await run(claude, ["mcp", "get", "meatdeck"]);
    if (!current.ok || !current.out.includes(MCP_ENTRY)) {
      await run(claude, ["mcp", "remove", "--scope", "user", "meatdeck"]);
      await run(claude, [
        // `-e` is variadic, so it must come after the name and be closed by `--`.
        "mcp",
        "add",
        "--scope",
        "user",
        "meatdeck",
        "-e",
        "ELECTRON_RUN_AS_NODE=1",
        "--",
        process.execPath,
        MCP_ENTRY,
      ]);
    }
    // Install the /today skill unless it's already linked to a working copy.
    const skillDir = join(homedir(), ".claude", "skills", "today");
    const isLink = existsSync(skillDir) && lstatSync(skillDir).isSymbolicLink();
    if (!isLink) {
      mkdirSync(skillDir, { recursive: true });
      cpSync(join(APP_ROOT, "skill", "today"), skillDir, { recursive: true });
    }
  }
}

// ---------- window ----------

const boundsFile = () => join(app.getPath("userData"), "window.json");

function savedBounds() {
  try {
    const b = JSON.parse(readFileSync(boundsFile(), "utf8"));
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x >= a.x - 50 && b.y >= a.y - 50 && b.x < a.x + a.width && b.y < a.y + a.height;
    });
    return visible ? b : null;
  } catch {
    return null;
  }
}

function createWindow() {
  win = new BrowserWindow({
    ...(savedBounds() ?? { width: 1320, height: 900 }),
    minWidth: 860,
    minHeight: 560,
    show: false,
    title: "MeatDeck (Alpha)",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#000000" : "#ffffff",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: TOPBAR_HEIGHT / 2 - TRAFFIC_LIGHT_RADIUS - 2 },
    webPreferences: {
      preload: join(APP_ROOT, "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win?.show());
  // macOS hides the traffic lights in full screen: tell the page so it drops the space it reserves for them.
  const sendFullscreen = () => win && !win.isDestroyed() && win.webContents.send("fullscreen", win.isFullScreen());
  win.on("enter-full-screen", sendFullscreen);
  win.on("leave-full-screen", sendFullscreen);
  win.webContents.on("did-finish-load", sendFullscreen);
  const persist = () => win && !win.isDestroyed() && writeFileSync(boundsFile(), JSON.stringify(win.getBounds()));
  win.on("resize", persist);
  win.on("move", persist);

  // Links open in the real browser; the window only ever shows the local app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Closing hides: the app stays alive so scheduled runs keep happening.
  win.on("close", (e) => {
    if (!quitting && process.platform === "darwin") {
      e.preventDefault();
      win?.hide();
    }
  });
  win.on("closed", () => (win = null));

  void win.loadURL(ORIGIN);
}

// ---------- IPC (exposed through preload as window.desktop) ----------

ipcMain.handle("badge:set", (_e, count: number) => {
  if (process.platform === "darwin") app.dock?.setBadge(count > 0 ? String(count) : "");
});
ipcMain.handle("login-item:get", () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle("login-item:set", (_e, on: boolean) => {
  app.setLoginItemSettings({ openAtLogin: on });
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle("window:show", () => {
  win?.show();
  win?.focus();
});

// ---------- lifecycle ----------

app.on("second-instance", () => {
  if (!win) createWindow();
  win?.show();
  win?.focus();
});
app.on("activate", () => {
  if (!win) createWindow();
  else win.show();
});
app.on("before-quit", () => {
  quitting = true;
  backend?.kill("SIGTERM");
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(async () => {
  loadLoginShellPath();
  // First packaged launch: start at login (hidden) so the morning brief is ready when you sit down.
  const marker = join(app.getPath("userData"), "first-run");
  if (app.isPackaged && !existsSync(marker)) {
    app.setLoginItemSettings({ openAtLogin: true });
    writeFileSync(marker, new Date().toISOString());
  }
  await ensureBackend();
  void ensureClaudeSetup();
  // Launched at login → stay in the background (dock only) until clicked.
  const login = app.getLoginItemSettings();
  if (!login.wasOpenedAtLogin) createWindow();
});
