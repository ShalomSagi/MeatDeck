/** Whole calendar days from `today` to `due` (both YYYY-MM-DD); negative when overdue. */
export function daysUntil(due: string, today: string): number {
  return Math.round((new Date(`${due}T00:00`).getTime() - new Date(`${today}T00:00`).getTime()) / 86_400_000);
}
