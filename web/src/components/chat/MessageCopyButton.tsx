/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/MessageCopyButton.tsx
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui.tsx";

export function MessageCopyButton({
  text,
  label = "Copy message",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Button
      aria-label={label}
      title={copied ? "Copied" : label}
      size="icon-xs"
      variant="ghost-muted"
      disabled={copied}
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
    </Button>
  );
}
