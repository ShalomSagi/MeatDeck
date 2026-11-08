import { describe, expect, it } from "vitest";
import type { Action } from "../../shared/actions.ts";
import { withoutActions, type BoardEntry } from "./board.ts";

describe("withoutActions", () => {
  const entries = [
    { key: "pr", url: "https://github.com/acme/app/pull/1" },
    { key: "item", itemId: "I-1" },
    { key: "other", url: "https://github.com/acme/app/pull/2", itemId: "I-2" },
    { key: "bare" },
  ] as BoardEntry[];

  it.each([
    [[], ["pr", "item", "other", "bare"]],
    [[{ url: "https://github.com/acme/app/pull/1" }], ["item", "other", "bare"]],
    [
      [{ itemId: "I-1" }, { itemId: "I-2" }],
      ["pr", "bare"],
    ],
    // an action without a url or item hides nothing
    [[{}], ["pr", "item", "other", "bare"]],
  ])("actions %j", (actions, want) => {
    expect(withoutActions(entries, actions as Action[]).map((e) => e.key)).toEqual(want);
  });
});
