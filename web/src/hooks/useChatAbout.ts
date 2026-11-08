/** "Chat about this" on a queue row attaches the row to the composer. */
import { useEffect, useState } from "react";
import type { ContextRef } from "../../../shared/types.ts";

export function useChatAbout() {
  const [attach, setAttach] = useState<{ ref: ContextRef; n: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setAttach((cur) => ({ ref: (e as CustomEvent<ContextRef>).detail, n: (cur?.n ?? 0) + 1 }));
    window.addEventListener("meatdeck:chat-about", on);
    return () => window.removeEventListener("meatdeck:chat-about", on);
  }, []);
  return attach;
}
