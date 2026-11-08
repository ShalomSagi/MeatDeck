/** One reply, rendered as T3 Code's timeline (see ChatTimeline.tsx), with result cards after it. */
import type { ProviderId } from "../../../../shared/providers.ts";
import type { ChatArtifact, ChatMessage, NoteMeta } from "../../../../shared/types.ts";
import { ArtifactCard } from "./ArtifactCard.tsx";
import { AssistantTimeline } from "./AssistantTimeline.tsx";
import { uniqueKeys } from "../../lib.ts";

export function AssistantTurn({
  m,
  last,
  provider,
  model,
  docs,
  onOpenNote,
  onGoToday,
}: {
  m: ChatMessage;
  last?: boolean;
  provider: ProviderId;
  model: string;
  docs?: NoteMeta[];
  onOpenNote: (id: string) => void;
  onGoToday: () => void;
}) {
  const artifacts = m.artifacts ?? [];
  const artifactKeys = uniqueKeys(artifacts, artifactKey);
  return (
    <AssistantTimeline m={m} provider={provider} model={model} last={last}>
      {artifacts.length > 0 &&
        artifacts.map((a, i) => (
          <ArtifactCard key={artifactKeys[i]} a={a} docs={docs} onOpenNote={onOpenNote} onGoToday={onGoToday} />
        ))}
    </AssistantTimeline>
  );
}

function artifactKey(a: ChatArtifact): string {
  switch (a.kind) {
    case "note":
      return `note:${a.id}`;
    case "todos":
    case "drafts":
      return `${a.kind}:${a.ids.join(",")}`;
    case "sent":
      return `sent:${a.channel}:${a.to}:${a.text}`;
    case "link":
      return `link:${a.url}`;
  }
}
