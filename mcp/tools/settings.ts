// Settings and runs: read and change settings, save the user's voice, start a Claude run.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ProviderStatus } from "../../shared/providers.ts";
import type { Settings } from "../../shared/types.ts";
import { api, ok } from "../api.ts";

export function registerSettingsTools(server: McpServer) {
  server.registerTool(
    "get_settings",
    {
      description: "MeatDeck settings: schedule (morning brief, pulse, wrap-up), models, idle skip, hidden repos.",
      inputSchema: {},
    },
    async () => {
      const s: Settings = await api("GET", "/api/settings");
      delete s.alwaysAllowTools;
      // Compact: which providers are usable and their model slugs, nothing else.
      const providers = ((await api("GET", "/api/providers")) as ProviderStatus[])
        .filter((p) => p.enabled && p.installed)
        .map((p) => ({ id: p.id, status: p.status, models: p.models.map((m) => m.slug) }));
      return ok({ ...s, providers });
    },
  );

  server.registerTool(
    "update_settings",
    {
      description:
        "Change MeatDeck settings. hideRepos/showRepos ('owner/name') hide or un-hide GitHub repos (hidden repos are never fetched or spent tokens on). Schedule: morning {enabled,time 'HH:MM',days [0=Sun..6]}, pulse {enabled,everyMinutes,from,to}, wrapup {enabled,time}. Models: model (default for runs, '' = Claude Code default), pulseModel (Claude models only: runs need Claude). Chat default: chatModel + chatProvider ('claude' | 'codex' | 'cursor') + chatEffort ('' = model default); valid models per provider are in get_settings' providers list. skipWhenIdleMinutes.",
      inputSchema: {
        hideRepos: z.array(z.string()).optional(),
        showRepos: z.array(z.string()).optional(),
        morning: z
          .object({
            enabled: z.boolean().optional(),
            time: z.string().optional(),
            days: z.array(z.number()).optional(),
          })
          .optional(),
        pulse: z
          .object({
            enabled: z.boolean().optional(),
            everyMinutes: z.number().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
        wrapup: z.object({ enabled: z.boolean().optional(), time: z.string().optional() }).optional(),
        model: z.string().optional(),
        pulseModel: z.string().optional(),
        chatModel: z.string().optional(),
        chatProvider: z.enum(["claude", "codex", "cursor"]).optional(),
        chatEffort: z.string().optional(),
        skipWhenIdleMinutes: z.number().optional(),
      },
    },
    async ({ hideRepos, showRepos, ...patch }) => {
      const body: Record<string, unknown> = { ...patch };
      if (hideRepos || showRepos) {
        const cur: string[] = (await api("GET", "/api/settings")).ignoredRepos ?? [];
        const drop = new Set((showRepos ?? []).map((r) => r.toLowerCase()));
        body.ignoredRepos = [...new Set([...cur, ...(hideRepos ?? [])])].filter((r) => !drop.has(r.toLowerCase()));
      }
      await api("PATCH", "/api/settings", body);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "set_voice",
    {
      description:
        "Save how the user writes (from a 'learn your voice' run): a concrete style guide, a few of their real messages as examples, and what it was learned from. Every future draft follows it.",
      inputSchema: {
        guide: z
          .string()
          .describe(
            "120-200 words of concrete rules: languages and when, length, greetings, punctuation, emoji, how they ask and nudge, phrases, never-dos",
          ),
        examples: z.array(z.string()).describe("5-8 of their real messages, verbatim and short"),
        sources: z
          .object({ slack: z.number().optional(), github: z.number().optional(), edits: z.number().optional() })
          .optional(),
      },
    },
    async (input) => {
      await api("PUT", "/api/voice", input);
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "start_run",
    {
      description:
        "Start a MeatDeck Claude run now: morning (full brief), pulse (quick check of what changed), wrapup (end of day), voice (re-learn the user's writing voice), project_discovery (search for a project's work; needs projectId). These spend tokens: only when the user asks.",
      inputSchema: {
        kind: z.enum(["morning", "pulse", "wrapup", "voice", "project_discovery"]),
        projectId: z.string().optional(),
      },
    },
    async ({ kind, projectId }) => {
      if (kind === "voice") return ok(await api("POST", "/api/voice/learn", {}));
      if (kind === "project_discovery") {
        if (!projectId) throw new Error("projectId required");
        return ok(await api("POST", `/api/projects/${projectId}/discover`, {}));
      }
      return ok(await api("POST", "/api/claude/run", { kind }));
    },
  );
}
