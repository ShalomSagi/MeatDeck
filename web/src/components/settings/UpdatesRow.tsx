import { LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { DashboardState } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { confirmUpdate } from "../sidebar/UpdateButton.tsx";
import { Button } from "../ui.tsx";

export function UpdatesRow({ state }: { state: DashboardState }) {
  const u = state.update;
  const [checking, setChecking] = useState(false);
  const built = u.builtAt
    ? new Date(u.builtAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const line =
    u.state === "unsupported"
      ? u.message
      : u.state === "available"
        ? u.channel === "release"
          ? `Version ${u.latest} is available.`
          : `A newer build is ready: ${u.changed.length} source file${u.changed.length === 1 ? "" : "s"} changed.`
        : u.state === "updating"
          ? `${u.progress ?? "Updating…"} MeatDeck restarts when it's ready.`
          : u.state === "failed" || u.state === "error"
            ? u.message?.split("\n")[0]
            : (u.message ?? "Up to date.");
  return (
    <div id="setting-updates" className="px-4 py-3">
      <div className="flex items-center gap-3">
        <RefreshCw className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Updates</p>
          <p className="text-xs text-muted-foreground">
            {line}
            {built && (
              <span className="text-muted-foreground/70">
                {" "}
                · this build: v{u.version}, {built}
              </span>
            )}
          </p>
        </div>
        {u.state !== "unsupported" && (
          <>
            <Button
              size="xs"
              variant="ghost-muted"
              disabled={checking || u.state === "updating"}
              onClick={async () => {
                setChecking(true);
                try {
                  await api.checkUpdate();
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? <LoaderCircle className="animate-spin" /> : null} Check now
            </Button>
            {(u.state === "available" || u.state === "failed") && (
              <Button size="xs" onClick={() => confirmUpdate(state) && void api.applyUpdate()}>
                {u.state === "failed" ? "Try again" : "Update and restart"}
              </Button>
            )}
          </>
        )}
      </div>
      {u.state === "available" && u.channel === "release" && u.notes && (
        <p className="mt-2 max-h-40 overflow-auto pl-7 text-xs leading-5 whitespace-pre-line text-muted-foreground">
          {u.notes}
        </p>
      )}
      {u.state === "available" && u.channel !== "release" && (
        <p className="mt-2 pl-7 font-mono text-2xs leading-4 whitespace-pre-line text-muted-foreground/80">
          {u.changed.slice(0, 8).join("\n")}
          {u.changed.length > 8 ? `\n…and ${u.changed.length - 8} more` : ""}
        </p>
      )}
      {u.state === "failed" && u.message && (
        <pre className="mt-2 ml-7 max-h-40 overflow-auto rounded-md bg-accent p-2 font-mono text-2xs leading-4 whitespace-pre-wrap text-muted-foreground">
          {u.message}
        </pre>
      )}
      {u.repo && <p className="mt-1 pl-7 text-2xs text-muted-foreground/60">Rebuilds from {u.repo}</p>}
      {u.github && (
        <p className="mt-1 pl-7 text-2xs text-muted-foreground/60">
          Updates from{" "}
          <a
            className="underline hover:text-foreground"
            href={u.releaseUrl ?? `https://github.com/${u.github}/releases`}
            target="_blank"
            rel="noreferrer"
          >
            github.com/{u.github} releases
          </a>
        </p>
      )}
    </div>
  );
}
