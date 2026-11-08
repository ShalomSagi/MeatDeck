import { KeyRound, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Integration } from "../../../../../shared/integrations.ts";
import { api } from "../../../api.ts";
import { Button, Card } from "../../ui.tsx";

export function Secrets({ i, onChange }: { i: Integration; onChange: (secrets: string[]) => void }) {
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Card className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="size-3.5" /> Secrets live in the macOS Keychain, never in MeatDeck's files. Reference them
        as <code className="rounded bg-accent px-1 font-mono">{"{{secret:NAME}}"}</code>.
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {(i.secrets ?? []).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <code className="w-40 truncate font-mono text-xs">{s}</code>
            <input
              type="password"
              value={values[s] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [s]: e.target.value }))}
              placeholder="paste a new value"
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs dark:bg-input/32"
            />
            <Button
              size="xs"
              variant="outline"
              disabled={!values[s]}
              onClick={async () => {
                await api.setIntegrationSecret(i.id, s, values[s]);
                setValues((v) => ({ ...v, [s]: "" }));
                setSaved(s);
                setTimeout(() => setSaved(null), 1500);
              }}
            >
              {saved === s ? "Saved" : "Set"}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label="Remove"
              onClick={() => onChange((i.secrets ?? []).filter((x) => x !== s))}
            >
              <X />
            </Button>
          </div>
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_");
            if (n) onChange([...new Set([...(i.secrets ?? []), n])]);
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="NEW_SECRET_NAME"
            className="h-7 w-48 rounded-md border border-input bg-background px-2 font-mono text-xs dark:bg-input/32"
          />
          <Button size="xs" variant="ghost" type="submit">
            <Plus /> Add secret
          </Button>
        </form>
      </div>
    </Card>
  );
}
