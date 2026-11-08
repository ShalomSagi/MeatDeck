/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/AgentElapsed.tsx (tickTextContent)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
/** Re-renders every second while `live` (T3's tickTextContent). */
import { useEffect, useState } from "react";

export function useNow(live: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [live]);
  return now;
}
