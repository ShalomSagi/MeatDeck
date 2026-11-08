// The action queue: merge, re-run CI, start in T3, dismiss, snooze, "Change…", priorities, and
// do_action's single door for all of them.
import type { Hono } from "hono";
import { actionJob } from "../claude/jobs.ts";
import { enqueue } from "../claude/runQueue.ts";
import { changes } from "../changes.ts";
import { currentActions } from "../dashboard.ts";
import { mergePr } from "../github.ts";
import { watchClosely } from "../githubPolling.ts";
import { provider, runAction } from "../integrations.ts";
import { syncGithub } from "../reconcile.ts";
import { localDate } from "../store/helpers.ts";
import { store } from "../store/store.ts";
import { startInT3, t3Available } from "../t3.ts";

export function registerActionRoutes(app: Hono) {
  app.post("/api/actions/merge", async (c) => {
    const { url } = await c.req.json();
    // Merge through the code-hosting integration (built-in gh for GitHub; CLI/API for others).
    const gh = store.integration("github");
    const res =
      /github\.com\//.test(url) && gh?.enabled && gh.actions.mergePullRequest?.kind === "builtin"
        ? await mergePr(url)
        : await (async () => {
            const p = provider("code", "mergePullRequest");
            if (!p) return { ok: false as const, error: "No code-hosting integration can merge" };
            const r = await runAction(p.id, "mergePullRequest", { url });
            return r.ok ? { ok: true as const, method: p.name } : { ok: false as const, error: r.error };
          })();
    if (res.ok) await syncGithub(); // reconcile closes its todos/drafts and logs the event
    watchClosely();
    changes.emit("change");
    return c.json(res, res.ok ? 200 : 422);
  });
  app.post("/api/actions/rerun", async (c) => {
    const { url } = await c.req.json();
    const p = provider("code", "rerunFailedChecks");
    if (!p) return c.json({ ok: false, error: "No code-hosting integration can re-run checks" }, 422);
    const r = await runAction(p.id, "rerunFailedChecks", { url });
    if (r.ok) watchClosely();
    return c.json(
      r.ok ? { ok: true, message: String(r.output ?? "Re-running") } : { ok: false, error: r.error },
      r.ok ? 200 : 422,
    );
  });
  /** One door for "do X to this queue row" (the chat agent uses it via the do_action MCP tool). */
  app.post("/api/actions/do", async (c) => {
    const { key, action } = (await c.req.json()) as { key: string; action: string };
    const a = currentActions().open.find((x) => x.key === key);
    if (!a)
      return c.json(
        { ok: false, error: `No open action with key "${key}" (keys are in get_dashboard → actions)` },
        404,
      );
    const self = (path: string, body: unknown) =>
      app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json", host: c.req.header("host") ?? "127.0.0.1" },
        body: JSON.stringify(body),
      });
    let res: Response;
    switch (action) {
      case "snooze":
        res = await self("/api/actions/snooze", { key });
        break;
      case "dismiss":
        res = await self("/api/actions/dismiss", { key });
        break;
      case "done":
        res = await self("/api/actions/dismiss", { key, done: true });
        break;
      case "clear_priority":
        store.clearPriority(key);
        changes.emit("change");
        return c.json({ ok: true });
      case "merge":
        if (!a.pr) return c.json({ ok: false, error: "Not a pull request" }, 422);
        res = await self("/api/actions/merge", { url: a.pr.url });
        break;
      case "rerun_ci":
        if (!a.pr) return c.json({ ok: false, error: "Not a pull request" }, 422);
        res = await self("/api/actions/rerun", { url: a.pr.url });
        break;
      case "start_in_t3":
        if (!a.pr || !a.agentPrompt)
          return c.json({ ok: false, error: "Only PR fix/review work can start in T3" }, 422);
        res = await self("/api/actions/t3", {
          url: a.pr.url,
          repo: a.pr.repo,
          number: a.pr.number,
          verb: a.verb,
          title: a.title,
          prompt: a.agentPrompt,
        });
        break;
      case "agent_prompt":
        return c.json(
          a.agentPrompt ? { ok: true, prompt: a.agentPrompt } : { ok: false, error: "No agent prompt for this action" },
        );
      default:
        return c.json({ ok: false, error: `Unknown action "${action}"` }, 400);
    }
    return c.json(await res.json(), res.status as 200);
  });
  app.post("/api/actions/t3", async (c) => {
    const body = await c.req.json();
    if (!body?.url || !body?.prompt || !body?.repo) return c.json({ ok: false, error: "missing url/repo/prompt" }, 400);
    const r = await startInT3({
      url: body.url,
      repo: body.repo,
      number: Number(body.number),
      verb: String(body.verb),
      title: String(body.title),
      prompt: String(body.prompt),
    });
    if (r.ok) watchClosely(45); // the agent needs a while: fix, push, CI
    return c.json(r, r.ok ? 200 : 422);
  });

  app.get("/api/t3", (c) => c.json({ available: t3Available() }));

  app.post("/api/actions/dismiss", async (c) => {
    const { key, done } = (await c.req.json()) as { key: string; done?: boolean };
    const a = currentActions().open.find((x) => x.key === key);
    if (!a) return c.json({ ok: false, error: "action not found" }, 404);
    store.dismiss({
      key,
      verb: a.verb,
      title: a.title,
      todoId: a.todoId,
      messageId: a.messageId,
      ...(done ? { done: true } : {}),
    });
    changes.emit("change");
    return c.json({ ok: true });
  });
  app.delete("/api/actions/dismiss/:key", (c) => {
    store.undismiss(decodeURIComponent(c.req.param("key")));
    changes.emit("change");
    return c.json({ ok: true });
  });
  app.post("/api/actions/snooze", async (c) => {
    const { key, until } = await c.req.json();
    const d = new Date();
    d.setDate(d.getDate() + 1);
    store.snooze(key, until ?? localDate(d));
    return c.json({ ok: true });
  });
  app.post("/api/actions/assist", async (c) => {
    const { key, instruction } = await c.req.json();
    const action = currentActions().open.find((a) => a.key === key);
    if (!action) return c.json({ error: "action not found" }, 404);
    return c.json({ queued: enqueue(actionJob(action, instruction?.trim() || undefined)) });
  });
  app.post("/api/priorities", async (c) => {
    const { priorities } = await c.req.json();
    // Pin each judgment to the step it was about, so "fix CI: now" doesn't outlive the fix.
    const verbs = new Map(currentActions().open.map((a) => [a.key, a.verb]));
    store.setPriorities((priorities ?? []).map((p: { key: string }) => ({ ...p, verb: verbs.get(p.key) })));
    return c.json({ ok: true });
  });
  app.delete("/api/priorities/:key", (c) => {
    store.clearPriority(decodeURIComponent(c.req.param("key")));
    return c.json({ ok: true });
  });
}
