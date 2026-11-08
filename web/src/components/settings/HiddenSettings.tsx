/** Hidden repos and projects: out of the UI, out of the gh query, never shown to Claude. */
import { EyeOff, Folder, FolderGit2 } from "lucide-react";
import { useState } from "react";
import { repoIgnored } from "../../../../shared/projects.ts";
import type { DashboardState } from "../../../../shared/types.ts";
import { api, setRepoIgnored } from "../../api.ts";
import { HiddenChip } from "./HiddenChip.tsx";
import { Button, Card, SectionHeader } from "../ui.tsx";

export function HiddenSettings({ state }: { state: DashboardState }) {
  const ignoredRepos = state.settings.ignoredRepos;
  const [repoDraft, setRepoDraft] = useState("");
  const knownRepos = [...new Set([...state.github.mine, ...state.github.reviewRequests].map((p) => p.repo))]
    .filter((r) => !repoIgnored(r, ignoredRepos))
    .sort();
  const hiddenProjects = state.projects.filter((p) => p.ignored);
  const visibleProjects = state.projects.filter((p) => !p.ignored).sort((a, b) => a.name.localeCompare(b.name));
  const addRepo = () => {
    const r = repoDraft.trim();
    if (!r) return;
    setRepoDraft("");
    void setRepoIgnored(ignoredRepos, r, true);
  };

  return (
    <section>
      <SectionHeader
        title="Hidden repos & projects"
        icon={<EyeOff />}
        count={ignoredRepos.length + hiddenProjects.length}
      />
      <Card className="divide-y divide-border">
        <p className="px-4 py-3 text-xs leading-4.5 text-muted-foreground">
          Hidden everywhere and skipped before any tokens are spent. A hidden{" "}
          <b className="font-medium text-foreground/80">repo</b> is excluded from GitHub's search, so code never sees
          its PRs. A hidden <b className="font-medium text-foreground/80">project</b> drops out of Claude's digest, so
          Claude never looks for its tickets, PRs or threads. You can also hide either from the sidebar.
        </p>
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
          <span className="flex w-20 items-center gap-1.5 text-xs text-muted-foreground">
            <FolderGit2 className="size-3.5" /> Repos
          </span>
          {ignoredRepos.map((r) => (
            <HiddenChip key={r} label={r} mono onRemove={() => void setRepoIgnored(ignoredRepos, r, false)} />
          ))}
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              addRepo();
            }}
          >
            <input
              list="meatdeck-repos"
              value={repoDraft}
              onChange={(e) => setRepoDraft(e.target.value)}
              placeholder="owner/repo…"
              className="h-6 w-44 rounded-md border border-input bg-popover px-2 font-mono text-xs dark:bg-input/32"
            />
            <datalist id="meatdeck-repos">
              {knownRepos.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            {repoDraft.trim() && (
              <Button size="xs" type="submit">
                Hide
              </Button>
            )}
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
          <span className="flex w-20 items-center gap-1.5 text-xs text-muted-foreground">
            <Folder className="size-3.5" /> Projects
          </span>
          {hiddenProjects.map((p) => (
            <HiddenChip key={p.id} label={p.name} onRemove={() => void api.updateProject(p.id, { ignored: false })} />
          ))}
          {visibleProjects.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && void api.updateProject(e.target.value, { ignored: true })}
              className="h-6 rounded-md border border-input bg-popover px-1.5 text-xs text-muted-foreground dark:bg-input/32"
            >
              <option value="">Hide a project…</option>
              {visibleProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>
    </section>
  );
}
