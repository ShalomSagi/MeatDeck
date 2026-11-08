/*
 * Ported from T3 Code (github.com/pingdotgg/t3code, MIT, © T3 Tools Inc.):
 *   apps/web/src/components/chat/AgentElapsed.tsx (elapsed formatting)
 * Only the presentational layer is ported; T3's stores, contracts and virtualization are not.
 */
function formatElapsedSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function elapsedBetween(startIso: string, endMs: number): string | null {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start) || !Number.isFinite(endMs)) return null;
  return formatElapsedSeconds((endMs - start) / 1000);
}
