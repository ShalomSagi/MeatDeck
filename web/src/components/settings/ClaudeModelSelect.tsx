/** Scheduled runs use Claude's skills and connectors, so they pick from Claude's discovered models. */
import type { ProviderStatus } from "../../../../shared/providers.ts";
import { ProviderIcon } from "../ProviderIcon.tsx";

export function ClaudeModelSelect({
  providers,
  value,
  onChange,
}: {
  providers: ProviderStatus[];
  value: string;
  onChange: (v: string) => void;
}) {
  const models = providers.find((p) => p.id === "claude")?.models ?? [];
  const known = models.some((m) => m.slug === value);
  return (
    <div className="flex items-center gap-1.5">
      <ProviderIcon provider="claude" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-44 rounded-md border border-input bg-popover px-1.5 text-xs dark:bg-input/32"
      >
        <option value="">Claude Code default</option>
        {!known && value && <option value={value}>{value}</option>}
        {models.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
