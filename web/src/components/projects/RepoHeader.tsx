import { FolderGit2 } from "lucide-react";

export function RepoHeader({ repo }: { repo: string }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <FolderGit2 className="size-4 text-muted-foreground" />
      <h2 className="font-mono text-lg font-semibold tracking-tight">{repo}</h2>
      <a
        href={`https://github.com/${repo}/pulls`}
        target="_blank"
        rel="noreferrer"
        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
      >
        Open on GitHub →
      </a>
    </div>
  );
}
