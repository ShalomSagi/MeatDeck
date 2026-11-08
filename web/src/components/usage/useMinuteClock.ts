/** The time, refreshed each minute: pace moves slowly, so that's fine-grained enough. */
import { useEffect, useState } from "react";

export function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
