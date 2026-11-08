// Human-readable bits of action rows: short PR titles, people lists, "3h ago".

export const people = (xs: string[]) =>
  xs.length > 2 ? `${xs.slice(0, 2).join(", ")} +${xs.length - 2}` : xs.join(", ");

/** "feat(ui): add select, dropdown menu… [ENG-118]" → "Add select, dropdown menu…" (≈60 chars, word boundary). */
export function shortPrTitle(title: string, max = 64): string {
  let t = title
    .replace(/\s*[[(](?:[A-Z][A-Z0-9]{1,9}-\d+(?:[,\s/]+)?)+[\])]\s*/g, " ") // [ENG-118], (ENG-1/ENG-2)
    .replace(/^\s*(?:[a-z]+)(?:\([^)]*\))?!?:\s*/i, "") // feat(ui): / fix: / chore!:
    .replace(/^\s*[A-Z][A-Z0-9]{1,9}-\d+[:\s-]+/, "") // "ENG-123: …"
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!t) t = title.trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 12)).replace(/[,;:.\s-]+$/, "")}…`;
}

/** "5m", "3h", "2d". */
export function agoShort(iso: string, now: Date): string {
  const m = Math.max(1, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m}m` : m < 24 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}
