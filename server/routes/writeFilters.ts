// Writes from Claude that are dropped or rejected: anything about hidden repos/projects (wasted
// tokens), and "homework" todos that ask the user to check something Claude should have checked.
import { hiddenBy } from "../../shared/projects.ts";
import { github } from "../github.ts";
import { store } from "../store/store.ts";

/** "Check whether…", "Verify…", "Look into…": a todo that asks the user to find out what Claude should have found out. */
const HOMEWORK =
  /^\s*(?:please\s+)?(?:check|verify|confirm|see\s+(?:if|whether)|look\s+(?:into|at|up)|investigate|find\s+out|figure\s+out|make\s+sense\s+of|double[-\s]check|determine|assess|evaluate\s+whether)\b/i;
export const isHomework = (title: string) => HOMEWORK.test(title ?? "");

// Writes from Claude for hidden repos/projects are dropped: work on them would be wasted tokens.
export function entityIndex() {
  return {
    projects: store.projects(),
    links: store.links(),
    items: store.items(),
    prs: [...github.mine, ...github.reviewRequests],
  };
}
export function hidden(repo: string | undefined, projectIds: string[]) {
  return hiddenBy(repo, projectIds, store.projects(), store.settings().ignoredRepos);
}
