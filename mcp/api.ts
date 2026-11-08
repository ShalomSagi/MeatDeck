// How the MCP tools reach MeatDeck: the local dashboard server over HTTP (so the UI updates live),
// and compact replies (every byte is re-read by Claude on each later turn).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DATA_DIR = process.env.MEATDECK_HOME ?? join(homedir(), ".meatdeck");

function baseUrl(): string {
  if (process.env.MEATDECK_URL) return process.env.MEATDECK_URL;
  try {
    const { port } = JSON.parse(readFileSync(join(DATA_DIR, "runtime.json"), "utf8"));
    return `http://127.0.0.1:${port}`;
  } catch {
    return "http://127.0.0.1:4317";
  }
}

export async function api(method: string, path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "The MeatDeck server isn't running. Ask the user to open MeatDeck.app (or run `pnpm start` in its source folder).",
    );
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Minified JSON: every byte here is re-read by Claude on each later turn.
export const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
export const ids = (rows: { id: string }[]) => ok({ ok: true, ids: rows.map((r) => r.id) });
