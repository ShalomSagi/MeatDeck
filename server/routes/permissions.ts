// Permissions: Claude asks, you decide (instead of the run failing).
import type { Hono } from "hono";
import type { PermissionRequest } from "../../shared/types.ts";
import { changes } from "../changes.ts";
import { allowRuleFor, decide, expire, permissionStatus, requestPermission } from "../permissions.ts";
import { store } from "../store/store.ts";

export function registerPermissionRoutes(app: Hono) {
  app.post("/api/permissions", async (c) => {
    const req = requestPermission(await c.req.json());
    notifyPermission(req);
    return c.json({ id: req.id });
  });
  app.get("/api/permissions/:id", (c) => c.json(permissionStatus(c.req.param("id"))));
  app.post("/api/permissions/:id/expire", (c) => {
    expire(c.req.param("id"));
    return c.json({ ok: true });
  });
  app.post("/api/permissions/:id/decide", async (c) => {
    const { decision } = (await c.req.json()) as { decision: "allow" | "always" | "deny" };
    const req = decide(c.req.param("id"), decision);
    if (req && decision === "always") {
      const rule = allowRuleFor(req.tool, req.input);
      const cur = store.settings().alwaysAllowTools ?? [];
      if (!cur.includes(rule)) store.updateSettings({ alwaysAllowTools: [...cur, rule] });
    }
    changes.emit("change");
    return c.json({ ok: !!req });
  });
}

/** The UI shows the request; this is just so a closed window still hears about it. */
function notifyPermission(_req: PermissionRequest) {
  changes.emit("change");
}
