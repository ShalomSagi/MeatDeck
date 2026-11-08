// How an integration talks to its service, and its status as a dot tone.
import { Bot, Globe, Plug, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import type { Driver, Integration, IntegrationStatus } from "../../../../../shared/integrations.ts";

export type IntegrationRow = Integration & { status: IntegrationStatus };

export const DRIVER: Record<Driver, { label: string; icon: ReactNode; hint: string }> = {
  builtin: { label: "Built-in", icon: <Plug />, hint: "MeatDeck's own code. No tokens." },
  cli: { label: "CLI", icon: <Terminal />, hint: "Runs a command on this Mac. No tokens." },
  http: {
    label: "API",
    icon: <Globe />,
    hint: "Calls an HTTP API. Tokens live in the macOS Keychain. No Claude tokens.",
  },
  claude: {
    label: "Claude",
    icon: <Bot />,
    hint: "Claude performs it with a connector you already have. Uses tokens when it runs.",
  },
};

export const tone = (s: IntegrationStatus) =>
  s.state === "ok" ? "success" : s.state === "warning" ? "warning" : s.state === "error" ? "error" : "muted";
