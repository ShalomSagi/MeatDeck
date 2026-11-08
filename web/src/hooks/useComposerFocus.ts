/** A counter the composer watches: bumping it focuses the prompt box. */
import { useEffect, useState } from "react";

export function useComposerFocus() {
  const [focusSignal, setFocusSignal] = useState(0);
  // ⌘K / Ctrl+K focuses the composer from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFocusSignal((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { focusSignal, focusComposer: () => setFocusSignal((n) => n + 1) };
}
