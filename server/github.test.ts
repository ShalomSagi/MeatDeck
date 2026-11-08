import { describe, expect, it } from "vitest";
import { checkMatches } from "./github.ts";

describe("checkMatches", () => {
  it.each([
    ["sonar", "SonarQube Code Analysis", true],
    ["Sonar*Analysis", "SonarQube Code Analysis", true],
    ["sonar*", "build (sonar)", false],
    ["build (*)", "build (linux)", true],
    ["a.b", "axb", false],
    ["  ", "anything", false],
  ])("%j matches %j: %s", (pattern, name, want) => {
    expect(checkMatches(pattern, name)).toBe(want);
  });
});
