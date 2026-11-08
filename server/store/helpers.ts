// Small helpers shared by the store modules: ids, timestamps, local dates and the not-found error.
import { randomUUID } from "node:crypto";
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const now = () => new Date().toISOString();
export const newId = () => randomUUID().slice(0, 8);

export class NotFound extends Error {}

export function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
