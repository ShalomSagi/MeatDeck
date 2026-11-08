import { ArrowUpRight, Check, Copy, LoaderCircle, MessagesSquare, Send, ThumbsUp } from "lucide-react";
import { useState } from "react";
import type { Message } from "../../../../shared/types.ts";
import { api } from "../../api.ts";
import { SourceIcon } from "../icons.tsx";
import { ChangePanel } from "./ChangePanel.tsx";
import type { Revision } from "./revision.ts";
import { Badge, Button, Card, cn } from "../ui.tsx";

export function MessageCard({
  message: m,
  sending,
  revision,
}: {
  message: Message;
  sending: boolean;
  revision: Revision;
}) {
  const [text, setText] = useState(m.text);
  const [changing, setChanging] = useState(false);
  const isDm = m.channel === "slack" && /^[UW][A-Z0-9]+$/.test(m.target ?? "");
  const [copied, setCopied] = useState(false);
  // A new draft from the server (a revision) replaces local edits.
  const [serverText, setServerText] = useState(m.text);
  if (m.text !== serverText) {
    setServerText(m.text);
    setText(m.text);
  }
  const dirty = text !== m.text;
  const approved = m.status === "approved";

  const save = () => dirty && api.updateMessage(m.id, { text });
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Card className={cn("overflow-hidden transition-colors", approved && "border-primary/40")}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <SourceIcon source={m.channel === "email" || m.channel === "other" ? "other" : m.channel} />
        <span className="text-sm font-medium">{m.to}</span>
        {m.threadTs && <Badge>thread</Badge>}
        {!m.threadTs && isDm && <Badge>DM</Badge>}
        {approved && (
          <Badge variant="primary">
            <ThumbsUp /> Approved
          </Badge>
        )}
        {m.url && (
          <a
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <ArrowUpRight className="size-3.5" />
          </a>
        )}
      </div>
      <p className="px-3 pt-1 text-xs leading-4.5 text-muted-foreground">{m.reason}</p>
      <div className="px-3 pt-2">
        <textarea
          dir="auto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          rows={Math.min(6, Math.max(2, text.split("\n").length + Math.floor(text.length / 70)))}
          className="w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm leading-5 outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20 dark:bg-input/32"
        />
      </div>
      {(changing || revision.pending || revision.last) && (
        <div className="px-3 pt-1.5">
          <ChangePanel
            kind="message"
            id={m.id}
            revision={revision}
            open={changing}
            onClose={() => setChanging(false)}
            placeholder="What should change? e.g. send it to Sally in DM instead"
          />
        </div>
      )}
      <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-2.5">
        <Button size="icon-xs" onClick={copy} title={copied ? "Copied" : "Copy text"} aria-label="Copy text">
          {copied ? <Check /> : <Copy />}
        </Button>
        <Button
          size="xs"
          variant="ghost-muted"
          title="Chat about this: reword it, send it somewhere else, ask about the thread…"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("meatdeck:chat-about", {
                detail: { type: "draft", id: m.id, title: `Message to ${m.to}` },
              }),
            )
          }
        >
          <MessagesSquare /> Chat about this
        </Button>
        {approved ? (
          <Button size="xs" variant="ghost-muted" onClick={() => api.updateMessage(m.id, { status: "draft" })}>
            Unapprove
          </Button>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => api.updateMessage(m.id, { status: "approved", text })}>
            <ThumbsUp /> Approve
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="xs" variant="ghost-muted" onClick={() => api.updateMessage(m.id, { status: "dismissed" })}>
            Dismiss
          </Button>
          <Button
            size="xs"
            variant="ghost-muted"
            title="You sent it yourself"
            onClick={() => api.updateMessage(m.id, { status: "sent", text })}
          >
            Mark sent
          </Button>
          <Button
            size="xs"
            variant="default"
            disabled={sending || revision.pending}
            title={`Claude sends this exact text via ${m.channel}`}
            onClick={() => api.sendMessages([m.id], { [m.id]: text })}
          >
            {sending ? <LoaderCircle className="animate-spin" /> : <Send />} {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
