// The user's voice: the learned style guide, and the edits they made to Claude's drafts before sending.
import type { Message, VoiceProfile, VoiceState } from "../../shared/types.ts";
import { now } from "./helpers.ts";
import type { Store } from "./store.ts";

export function voiceState(s: Store): VoiceState {
  const edits = s.data.voiceEdits ?? [];
  const since = s.data.voice?.updatedAt ?? "";
  return { profile: s.data.voice, edits, newEdits: edits.filter((e) => e.at > since).length };
}

export function setVoice(
  s: Store,
  input: { guide: string; examples?: string[]; sources?: VoiceProfile["sources"] },
): VoiceProfile {
  const prev = s.data.voice;
  s.data.voice = {
    guide: input.guide.trim(),
    examples: (input.examples ?? prev?.examples ?? [])
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 8),
    updatedAt: now(),
    sources: input.sources ?? prev?.sources,
  };
  s.save();
  return s.data.voice;
}

/** You sent something other than Claude's draft: remember the pair (plain code, no tokens). */
export function captureVoiceEdit(s: Store, msg: Message, sentText: string) {
  const drafted = (msg.draftedText ?? "").trim();
  const sent = sentText.trim();
  if (!drafted || !sent || drafted === sent) return;
  s.data.voiceEdits = [...(s.data.voiceEdits ?? []), { drafted, sent, to: msg.to, at: now() }].slice(-30);
}
