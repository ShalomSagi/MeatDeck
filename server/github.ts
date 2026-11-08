import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoIgnored } from "../shared/projects.ts";
import { isBot, type GithubPr, type GithubSnapshot } from "../shared/types.ts";
import { resolveBin } from "./shellEnv.ts";
import { store } from "./store/store.ts";

const run = promisify(execFile);

// Uses the local `gh` CLI login, so no token lives in this app.
const QUERY = `
query($mine: String!, $reviews: String!) {
  viewer { login }
  rateLimit { remaining resetAt }
  mine: search(query: $mine, type: ISSUE, first: 25) { nodes { ...pr } }
  reviews: search(query: $reviews, type: ISSUE, first: 25) { nodes { ...pr } }
}
fragment pr on PullRequest {
  id number title url isDraft createdAt updatedAt reviewDecision mergeable
  author { login }
  repository { nameWithOwner }
  commits(last: 1) { nodes { commit { statusCheckRollup { state contexts(first: 100) { nodes { __typename ... on CheckRun { name conclusion status startedAt completedAt } ... on StatusContext { context state createdAt } } } } } } }
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { name } } } }
  latestOpinionatedReviews(first: 10) { nodes { state author { login } } }
  baseRefName headRefName
  latestReviews(first: 20) { nodes { state submittedAt author { __typename login } } }
  reviewThreads(first: 50) { nodes { isResolved } }
}`;

interface RawPr {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  reviewDecision: GithubPr["reviewDecision"];
  mergeable: GithubPr["mergeable"];
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  commits: {
    nodes: {
      commit: {
        statusCheckRollup: {
          state: GithubPr["checks"];
          contexts?: {
            nodes: {
              __typename: string;
              name?: string;
              conclusion?: string | null;
              status?: string;
              context?: string;
              state?: string;
              startedAt?: string | null;
              completedAt?: string | null;
              createdAt?: string;
            }[];
          };
        } | null;
      };
    }[];
  };
  reviewRequests: { nodes: { requestedReviewer: { login?: string; name?: string } | null }[] };
  baseRefName?: string;
  headRefName?: string;
  latestReviews?: {
    nodes: { state: string; submittedAt: string | null; author: { __typename: string; login: string } | null }[];
  };
  latestOpinionatedReviews: { nodes: { state: string; author: { login: string } | null }[] };
  reviewThreads: { nodes: { isResolved: boolean }[] };
}

function toPr(raw: RawPr): GithubPr {
  const reviews = raw.latestOpinionatedReviews.nodes;
  const by = (state: string) => reviews.filter((r) => r.state === state).map((r) => r.author?.login ?? "?");
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    repo: raw.repository.nameWithOwner,
    author: raw.author?.login ?? "?",
    isDraft: raw.isDraft,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    reviewDecision: raw.reviewDecision,
    mergeable: raw.mergeable,
    ...effectiveChecks(raw.commits.nodes[0]?.commit.statusCheckRollup ?? null),
    pendingReviewers: raw.reviewRequests.nodes
      .map((n) => n.requestedReviewer?.login ?? n.requestedReviewer?.name)
      .filter((v): v is string => !!v),
    approvedBy: by("APPROVED"),
    changesRequestedBy: by("CHANGES_REQUESTED"),
    unresolvedThreads: raw.reviewThreads.nodes.filter((t) => !t.isResolved).length,
    baseRef: raw.baseRefName,
    headRef: raw.headRefName,
    reviews: (raw.latestReviews?.nodes ?? [])
      .filter(
        (n) =>
          n.author &&
          n.author.__typename === "User" &&
          n.submittedAt &&
          n.state !== "PENDING" &&
          !isBot(n.author.login),
      )
      .map((n) => ({ login: n.author!.login, state: n.state, at: n.submittedAt! })),
  };
}

export let github: GithubSnapshot = { mine: [], reviewRequests: [] };

// Short repo name → full "owner/name", remembered across polls so ignored repos can be
// excluded in the search query itself (GitHub never even returns them).
const fullNames = new Map<string, string>();

export async function refreshGithub(): Promise<GithubSnapshot> {
  // The built-in GitHub integration can be turned off (Settings → Integrations).
  if (store.integration("github")?.enabled === false) {
    github = { mine: [], reviewRequests: [], fetchedAt: new Date().toISOString() };
    return github;
  }
  const ignored = store.settings().ignoredRepos;
  const exclude = ignored
    .map((r) => (r.includes("/") ? r.trim() : fullNames.get(r.trim().toLowerCase())))
    .filter(Boolean)
    .map((full) => ` -repo:${full}`)
    .join("");
  try {
    const { stdout } = await run(
      resolveBin("gh"),
      [
        "api",
        "graphql",
        "-f",
        `query=${QUERY}`,
        "-f",
        `mine=is:pr is:open author:@me archived:false${exclude} sort:updated-desc`,
        "-f",
        `reviews=is:pr is:open user-review-requested:@me archived:false${exclude} sort:updated-desc`,
      ],
      { maxBuffer: 20 * 1024 * 1024, timeout: 30_000 },
    );
    const { data } = JSON.parse(stdout);
    const all: GithubPr[] = [...data.mine.nodes, ...data.reviews.nodes].filter((n: RawPr) => n.id).map(toPr);
    for (const pr of all) fullNames.set(pr.repo.split("/")[1].toLowerCase(), pr.repo);
    // Filter in code too: the query exclusion only knows repos it has seen before.
    const keep = (pr: GithubPr) => !repoIgnored(pr.repo, ignored);
    const mine = data.mine.nodes.filter((n: RawPr) => n.id).map(toPr);
    const reviewRequests = data.reviews.nodes.filter((n: RawPr) => n.id).map(toPr);
    github = {
      login: data.viewer.login,
      fetchedAt: new Date().toISOString(),
      mine: mine.filter(keep),
      reviewRequests: reviewRequests.filter(keep),
      ...(data.rateLimit ? { rate: { remaining: data.rateLimit.remaining, resetAt: data.rateLimit.resetAt } } : {}),
    };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    github = { ...github, error: (e.stderr || e.message).trim().slice(0, 500), fetchedAt: new Date().toISOString() };
  }
  return github;
}

/** Merge a PR with gh (no tokens). Picks the method the repo allows: squash, then merge, then rebase. */
export async function mergePr(url: string): Promise<{ ok: true; method: string } | { ok: false; error: string }> {
  const m = /github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  if (!m) return { ok: false, error: "not a PR url" };
  try {
    const { stdout } = await run(
      resolveBin("gh"),
      ["api", `repos/${m[1]}`, "--jq", "[.allow_squash_merge, .allow_merge_commit, .allow_rebase_merge] | @csv"],
      { timeout: 20_000 },
    );
    const [squash, merge, rebase] = stdout
      .trim()
      .split(",")
      .map((v) => v === "true");
    const method = squash ? "squash" : merge ? "merge" : rebase ? "rebase" : "squash";
    await run(resolveBin("gh"), ["pr", "merge", url, `--${method}`], { timeout: 60_000 });
    return { ok: true, method };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    return { ok: false, error: (e.stderr || e.message).trim().split("\n").slice(-3).join(" ").slice(0, 300) };
  }
}

/**
 * Re-run the failed GitHub Actions jobs on a PR (no tokens). Other CI systems (Buildkite…) have no
 * gh rerun, so they're reported back and the UI offers the copy-prompt instead.
 */
export async function rerunFailed(url: string): Promise<{ ok: true; runs: number } | { ok: false; error: string }> {
  const m = /github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  if (!m) return { ok: false, error: "not a PR url" };
  try {
    // gh pr checks exits 1 when something failed; the JSON is still on stdout.
    const out = await run(resolveBin("gh"), ["pr", "checks", url, "--json", "name,bucket,link"], {
      timeout: 30_000,
    }).then(
      (r) => r.stdout,
      (e: { stdout?: string }) => e.stdout ?? "[]",
    );
    const checks = JSON.parse(out || "[]") as { name: string; bucket: string; link: string }[];
    const ignore = store
      .rules()
      .filter((r) => r.enabled && r.kind === "ignore_check" && r.pattern)
      .map((r) => r.pattern!);
    const failed = checks.filter((c) => c.bucket === "fail" && !ignore.some((p) => checkMatches(p, c.name)));
    const ids = [...new Set(failed.map((c) => /\/actions\/runs\/(\d+)/.exec(c.link)?.[1]).filter(Boolean) as string[])];
    if (!ids.length)
      return {
        ok: false,
        error: failed.length
          ? `No GitHub Actions runs among the failing checks (${failed.map((c) => c.name).join(", ")})`
          : "No failed checks",
      };
    for (const id of ids)
      await run(resolveBin("gh"), ["run", "rerun", id, "--failed", "-R", m[1]], { timeout: 30_000 });
    return { ok: true, runs: ids.length };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    return { ok: false, error: (e.stderr || e.message).trim().split("\n").slice(-3).join(" ").slice(0, 300) };
  }
}

// ---------- CI with ignore rules (plain code) ----------

const FAILED_CONCLUSIONS = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]);

/** `sonar` matches "SonarQube Code Analysis"; `*` is a wildcard. Case-insensitive. */
export function checkMatches(pattern: string, name: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (!p.includes("*")) return name.toLowerCase().includes(p);
  const re = new RegExp(
    `^${p
      .split("*")
      .map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
    "i",
  );
  return re.test(name);
}

type Rollup = NonNullable<RawPr["commits"]["nodes"][number]["commit"]["statusCheckRollup"]>;

/**
 * GitHub's rollup counts every check. Recompute it without the checks the user's rules ignore
 * (e.g. SonarQube), so an ignored failure never turns into a "Fix CI" item.
 */
function effectiveChecks(rollup: Rollup | null): Pick<GithubPr, "checks" | "failingChecks" | "ignoredFailures"> {
  if (!rollup) return { checks: null };
  const patterns = store
    .rules()
    .filter((r) => r.enabled && r.kind === "ignore_check" && r.pattern)
    .map((r) => r.pattern!);
  const nodes = rollup.contexts?.nodes ?? [];
  if (!nodes.length) return { checks: rollup.state };
  // A check that ran several times (re-runs, or a PR edit re-triggering it) counts only by its latest
  // run: an old failure that a newer run replaced is not a failure. (GitHub's own rollup state still
  // counts it, so it's recomputed here.)
  const when = (n: (typeof nodes)[number]) => n.startedAt ?? n.completedAt ?? n.createdAt ?? "";
  const latest = new Map<string, (typeof nodes)[number]>();
  for (const n of nodes) {
    const name = n.name ?? n.context ?? "check";
    const cur = latest.get(name);
    if (!cur || when(n) >= when(cur)) latest.set(name, n);
  }
  let pending = false;
  const failing: string[] = [];
  const ignored: string[] = [];
  for (const n of latest.values()) {
    const name = n.name ?? n.context ?? "check";
    const failed =
      n.__typename === "CheckRun"
        ? n.status === "COMPLETED" && FAILED_CONCLUSIONS.has(n.conclusion ?? "")
        : n.state === "FAILURE" || n.state === "ERROR";
    const running =
      n.__typename === "CheckRun" ? n.status !== "COMPLETED" : n.state === "PENDING" || n.state === "EXPECTED";
    const skip = patterns.some((p) => checkMatches(p, name));
    if (failed) (skip ? ignored : failing).push(name);
    else if (running && !skip) pending = true;
  }
  const checks: GithubPr["checks"] = failing.length ? "FAILURE" : pending ? "PENDING" : "SUCCESS";
  const uniq = (xs: string[]) => [...new Set(xs)]; // re-runs repeat the same check name
  return {
    checks,
    failingChecks: failing.length ? uniq(failing) : undefined,
    ignoredFailures: ignored.length ? uniq(ignored) : undefined,
  };
}
