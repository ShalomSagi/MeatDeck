import { describe, expect, it } from "vitest";
import { repoOfUrl, sameRepo, ticketKeys } from "./projects.ts";

describe("ticketKeys", () => {
  it("finds each key once, ignoring lowercase and lookalikes", () => {
    expect(ticketKeys("[ENG-142] fix, see ENG-142 and OPS-7; not eng-3 or A-1 or UTF-8x")).toEqual([
      "ENG-142",
      "OPS-7",
    ]);
  });
});

describe("repos", () => {
  it("reads owner/name from any github.com URL", () => {
    expect(repoOfUrl("https://github.com/acme/app/pull/12#discussion")).toBe("acme/app");
    expect(repoOfUrl("https://example.com/acme/app")).toBeUndefined();
  });

  it.each([
    ["acme/app", "ACME/App", true],
    ["app", "acme/app", true],
    ["acme/app", "other/app", false],
    ["app", "acme/api", false],
  ])("sameRepo(%s, %s) = %s", (a, b, want) => {
    expect(sameRepo(a, b)).toBe(want);
  });
});
