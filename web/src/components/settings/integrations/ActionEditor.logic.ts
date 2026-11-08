import type { ActionImpl } from "../../../../../shared/integrations.ts";

/** One line under the action's name: what it runs, if it's set up. */
export function summary(impl: ActionImpl): string | undefined {
  switch (impl.kind) {
    case "builtin":
      return "Built in";
    case "cli":
      return impl.command ? `$ ${impl.command}` : undefined;
    case "http":
      return impl.url ? `${impl.method} ${impl.url}` : undefined;
    case "claude":
      return impl.how || undefined;
    default:
      return undefined;
  }
}

/** HTTP headers as editable "Name: value" lines. */
export function formatHeaders(headers: Record<string, string> | undefined): string {
  return Object.entries(headers ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** "Name: value" lines back to headers; lines without a name are dropped. Values keep their own colons. */
export function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    const name = (colon < 0 ? line : line.slice(0, colon)).trim();
    if (name) headers[name] = colon < 0 ? "" : line.slice(colon + 1).trim();
  }
  return headers;
}
