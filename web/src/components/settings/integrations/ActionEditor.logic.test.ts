import { describe, expect, it } from "vitest";
import type { ActionImpl } from "../../../../../shared/integrations.ts";
import { formatHeaders, parseHeaders, summary } from "./ActionEditor.logic.ts";

describe("summary", () => {
  it.each<[ActionImpl, string | undefined]>([
    [{ kind: "builtin" }, "Built in"],
    [{ kind: "cli", command: "jira issue view {{id}}", output: "text" }, "$ jira issue view {{id}}"],
    [{ kind: "cli", command: "", output: "text" }, undefined],
    [{ kind: "http", method: "POST", url: "https://x.test/a", output: "json" }, "POST https://x.test/a"],
    [{ kind: "http", method: "GET", url: "", output: "json" }, undefined],
    [{ kind: "claude", tools: [], how: "Search Slack" }, "Search Slack"],
    [{ kind: "claude", tools: [], how: "" }, undefined],
    [{ kind: "none" }, undefined],
  ])("%j", (impl, want) => {
    expect(summary(impl)).toBe(want);
  });
});

describe("headers", () => {
  it.each([
    ["Authorization: Bearer abc", { Authorization: "Bearer abc" }],
    ["Accept:application/json\n\n  \nX-Id:  7", { Accept: "application/json", "X-Id": "7" }],
    ["  Trimmed  : yes", { Trimmed: "yes" }],
    ["", {}],
    ["Authorization: Bearer {{secret:TOKEN}}", { Authorization: "Bearer {{secret:TOKEN}}" }],
    ["Host: api.acme.dev:8080", { Host: "api.acme.dev:8080" }],
  ])("parse %j", (text, want) => {
    expect(parseHeaders(text)).toEqual(want);
  });

  it("formats one header per line and reads back the same", () => {
    const headers = { Authorization: "Bearer x", Accept: "application/json" };
    expect(formatHeaders(headers)).toBe("Authorization: Bearer x\nAccept: application/json");
    expect(parseHeaders(formatHeaders(headers))).toEqual(headers);
    expect(formatHeaders(undefined)).toBe("");
  });
});
