// Drafted messages and the sent log (which turns a sent nudge's row into "waiting on them").
import type { Message } from "../../shared/types.ts";
import { newId, NotFound, now, stripUndefined } from "./helpers.ts";
import { prUrlsIn } from "./reviewAsks.ts";
import { captureVoiceEdit } from "./voice.ts";
import type { Store } from "./store.ts";

export function addMessages(
  s: Store,
  inputs: (Partial<Message> & Pick<Message, "to" | "text" | "reason">)[],
): Message[] {
  const day = s.today();
  const added: Message[] = [];
  for (const input of inputs) {
    const existing = day.messages.find(
      (m) => m.status !== "sent" && m.to === input.to && (m.url ?? "") === (input.url ?? ""),
    );
    if (existing) {
      Object.assign(existing, stripUndefined({ ...input, id: existing.id, status: existing.status }), {
        draftedText: input.text,
      });
      added.push(existing);
      continue;
    }
    const msg: Message = {
      ref: s.nextRef("D"),
      channel: "slack",
      ...stripUndefined(input),
      id: newId(),
      status: "draft",
      createdAt: now(),
      draftedText: input.text,
    };
    day.messages.push(msg);
    added.push(msg);
  }
  s.save();
  return added;
}

/** `by`: "claude" when the edit came from Claude (its wording), "me" when you typed it. */
export function updateMessage(s: Store, msgId: string, patch: Partial<Message>, by: "claude" | "me" = "me"): Message {
  const msg = s.today().messages.find((m) => m.id === msgId);
  if (!msg) throw new NotFound(`message ${msgId}`);
  const { draftedText: _ignored, ...rest } = patch;
  Object.assign(msg, stripUndefined(rest), { id: msg.id });
  if ((patch as { threadTs?: string | null }).threadTs === null) delete msg.threadTs; // moved out of the thread
  if (by === "claude" && patch.text) msg.draftedText = patch.text;
  if (patch.status === "sent") {
    msg.sentAt = now();
    captureVoiceEdit(s, msg, msg.text);
    // The url says which row it was about (a PR, a Slack thread, a stack nudge's #fragment url).
    if (msg.url) s.sentLog()[msg.url] = { at: msg.sentAt, to: msg.to };
    // A message carrying a PR link is a review ask for that PR (that's what "asked for review" means).
    for (const pr of prUrlsIn(`${msg.url ?? ""} ${msg.text}`))
      s.recordReviewAsk(pr, { at: msg.sentAt, where: msg.to, by: "meatdeck" });
  }
  s.save();
  return msg;
}

export function sentLog(s: Store): Record<string, { at: string; to: string }> {
  if (!s.data.sent) {
    // First run: backfill from messages already sent.
    s.data.sent = {};
    for (const d of s.allDays())
      for (const m of d.messages)
        if (m.status === "sent" && m.url && m.sentAt && (!s.data.sent[m.url] || s.data.sent[m.url].at < m.sentAt))
          s.data.sent[m.url] = { at: m.sentAt, to: m.to };
  }
  const log = s.data.sent;
  const cutoff = Date.now() - 14 * 86_400_000;
  for (const [k, v] of Object.entries(log)) if (new Date(v.at).getTime() < cutoff) delete log[k];
  return log;
}
