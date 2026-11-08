import { describe, expect, it } from "vitest";
import { parseDue } from "./notes.ts";

const now = new Date(2026, 10, 11, 9); // Wednesday Nov 11, 2026
const local = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

describe("parseDue", () => {
  it.each([
    ["Ship it @today", "Ship it", local(2026, 11, 11)],
    ["Ship it @tomorrow", "Ship it", local(2026, 11, 12)],
    ["@tmrw ship it", "ship it", local(2026, 11, 12)],
    ["Ship @fri it", "Ship it", local(2026, 11, 13)],
    ["Demo @wednesday", "Demo", local(2026, 11, 18)], // never today: the next one
    ["Plan @next-week", "Plan", local(2026, 11, 18)],
    ["Release @2027-01-05", "Release", local(2027, 1, 5)],
  ])("%s", (raw, text, due) => {
    expect(parseDue(raw, now)).toEqual({ text, due });
  });

  it("leaves text without a due token alone", () => {
    expect(parseDue("email me@acme.dev @someday", now)).toEqual({ text: "email me@acme.dev @someday" });
  });
});
