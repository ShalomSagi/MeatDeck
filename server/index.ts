// The backend: a Hono app on 127.0.0.1 (routes in routes/), plus what runs on its own: the GitHub
// poller, the Claude scheduler, Linear project syncs, integration and provider checks, usage scans.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { changes } from "./changes.ts";
import { chatEvents } from "./chat/chatStore.ts";
import { linearSyncJob } from "./claude/jobs.ts";
import { enqueue, runs } from "./claude/runQueue.ts";
import { refreshStatuses } from "./dashboard.ts";
import { startGithubPolling } from "./githubPolling.ts";
import { permissionEvents } from "./permissions.ts";
import { providerEvents, refreshProviders } from "./providers/registry.ts";
import { registerActionRoutes } from "./routes/actions.ts";
import { registerChatRoutes } from "./routes/chats.ts";
import { registerGithubRoutes } from "./routes/github.ts";
import { registerIntegrationRoutes } from "./routes/integrations.ts";
import { registerMessageRoutes } from "./routes/messages.ts";
import { registerNoteRoutes } from "./routes/notes.ts";
import { registerPermissionRoutes } from "./routes/permissions.ts";
import { registerProjectRoutes } from "./routes/projects.ts";
import { registerProviderRoutes } from "./routes/providers.ts";
import { registerRuleRoutes } from "./routes/rules.ts";
import { registerRunRoutes } from "./routes/runs.ts";
import { registerStateRoutes } from "./routes/state.ts";
import { registerTodoRoutes } from "./routes/todos.ts";
import { startScheduler } from "./scheduler.ts";
import { loadLoginShellPath } from "./shellEnv.ts";
import { NotFound } from "./store/helpers.ts";
import { DATA_DIR } from "./store/persistence.ts";
import { store } from "./store/store.ts";
import { startUpdateChecks, updateEvents } from "./updates.ts";
import { scanUsage } from "./usage.ts";

loadLoginShellPath();

const PORT = Number(process.env.PORT ?? 4317);
const HOST = "127.0.0.1"; // never listen on the network
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.MEATDECK_DIST ?? join(ROOT, "dist");

store.on("change", () => changes.emit("change"));
runs.on("change", () => changes.emit("change"));

const app = new Hono();

// Only localhost may talk to us: reject other Host headers (DNS rebinding) and
// cross-site writes (a page elsewhere can't send JSON here without CORS, which we never grant).
app.use("*", async (c, next) => {
  const host = (c.req.header("host") ?? "").split(":")[0];
  if (host !== "localhost" && host !== "127.0.0.1") return c.text("forbidden host", 403);
  if (c.req.method !== "GET") {
    const origin = c.req.header("origin");
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return c.text("forbidden origin", 403);
    if (c.req.method !== "DELETE" && !(c.req.header("content-type") ?? "").includes("application/json"))
      return c.text("json only", 415);
  }
  await next();
});

app.onError((err, c) => {
  if (err instanceof NotFound) return c.json({ error: `${err.message} not found` }, 404);
  console.error(err);
  return c.json({ error: err.message }, 500);
});

registerStateRoutes(app);
registerTodoRoutes(app);
registerMessageRoutes(app);
registerGithubRoutes(app);
registerRunRoutes(app);
registerProjectRoutes(app);
registerActionRoutes(app);
registerProviderRoutes(app);
registerRuleRoutes(app);
registerPermissionRoutes(app);
registerIntegrationRoutes(app);
registerNoteRoutes(app);
registerChatRoutes(app);

if (existsSync(DIST)) {
  app.use("/*", serveStatic({ root: relative(process.cwd(), DIST) }));
  app.get("*", serveStatic({ path: relative(process.cwd(), join(DIST, "index.html")) }));
} else {
  app.get("/", (c) => c.text("UI not built. Run `pnpm build`, or use `pnpm dev` and open http://localhost:5173"));
}

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, () => {
  writeFileSync(join(DATA_DIR, "runtime.json"), JSON.stringify({ port: PORT, pid: process.pid }));
  console.log(`meatdeck → http://localhost:${PORT}  (data: ${DATA_DIR})`);
});

// GitHub stays close to live: a refresh is one GraphQL call costing ~3 of the 5,000 points/hour
// (no tokens), so it runs every 30s while you're at the Mac, every 15s for a while after you act
// (start a fix in T3, re-run CI, merge, send), every 2 min when you're away, and right away when
// you switch to MeatDeck. The rate limit is shared with every gh user on this Mac (your agents too),
// so it backs off to 5 min when fewer than 1,000 points are left.
startGithubPolling();
const scheduling = !process.env.MEATDECK_NO_SCHEDULER; // tests/dev: run without spending tokens
if (scheduling) startScheduler();

// Linear projects get their description from Linear: when one appears without it, or weekly.
// Decided in code; a narrow small-model run fetches only what's missing, at most every 6h per project.
const linearAttempts = new Map<string, number>();
const syncLinearProjects = () => {
  const week = 7 * 86_400_000;
  const due = store
    .projects()
    .filter((p) => p.kind === "linear" && !p.ignored)
    .filter(
      (p) =>
        !p.linearSyncedAt || p.linearPriority === undefined || Date.now() - new Date(p.linearSyncedAt).getTime() > week,
    )
    .filter((p) => Date.now() - (linearAttempts.get(p.id) ?? 0) > 6 * 3_600_000)
    .slice(0, 8);
  if (!due.length) return;
  for (const p of due) linearAttempts.set(p.id, Date.now());
  enqueue(linearSyncJob(due.map((p) => ({ id: p.id, name: p.name }))));
};
let linearTimer: ReturnType<typeof setTimeout> | undefined;
if (scheduling) {
  store.on("change", () => {
    clearTimeout(linearTimer);
    linearTimer = setTimeout(syncLinearProjects, 30_000);
  });
  setTimeout(syncLinearProjects, 20_000);
}

// Integration health (gh login, CLIs on PATH, Keychain secrets, Claude connectors): plain code, cached.
setTimeout(() => void refreshStatuses(true), 8_000);
setInterval(() => void refreshStatuses(true), 10 * 60_000);

// Token usage from local transcripts: on start, every 10 min, and after each Claude run.
const rescan = async () => {
  await scanUsage();
  changes.emit("change");
};
void rescan();
setInterval(rescan, 10 * 60_000);
runs.on("finished", () => setTimeout(rescan, 3_000));
chatEvents.on("finished", () => setTimeout(rescan, 3_000));
chatEvents.on("list", () => changes.emit("change"));
providerEvents.on("change", () => changes.emit("change"));
updateEvents.on("change", () => changes.emit("change"));
startUpdateChecks();
// Provider probes are CLI calls only (no tokens): shortly after start, then a few times a day.
setTimeout(() => void refreshProviders(), 12_000);
setInterval(() => void refreshProviders(), 6 * 60 * 60_000);
permissionEvents.on("change", () => changes.emit("change"));

// Roll over to a new day after midnight even if nobody touches the store.
setInterval(() => store.today(), 60_000);
