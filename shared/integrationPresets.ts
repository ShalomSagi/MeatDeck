// The integrations MeatDeck ships with (GitHub built in; Linear, Slack, Notion, Buildkite and
// Google Calendar through Claude's connectors). Seeded into the store once; the user can edit them.
import type { ActionImpl, Integration } from "./integrations.ts";

const claude = (tools: string[], how: string): ActionImpl => ({ kind: "claude", tools, how });
const SLACK = (t: string) => `mcp__claude_ai_Slack__${t}`;
const LINEAR = (t: string) => `mcp__claude_ai_Linear__${t}`;
const NOTION = (t: string) => `mcp__claude_ai_Notion__${t}`;
const BK = (t: string) => `mcp__claude_ai_buildkite__${t}`;

/** The integrations MeatDeck ships with: what it already did, expressed as integrations. */
export const PREDEFINED: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    category: "code",
    driver: "builtin",
    enabled: true,
    predefined: true,
    icon: "github",
    description: "Through your local gh login. Built into MeatDeck: no tokens spent on polling, merging or commenting.",
    actions: Object.fromEntries(
      [
        "listMyPullRequests",
        "listReviewRequests",
        "getPullRequestState",
        "readPullRequestComments",
        "mergePullRequest",
        "rerunFailedChecks",
        "commentOnPullRequest",
        "listMyComments",
      ].map((a) => [a, { kind: "builtin" }]),
    ),
  },
  {
    id: "linear",
    name: "Linear",
    category: "issues",
    driver: "claude",
    enabled: true,
    predefined: true,
    icon: "linear",
    mcpServer: "claude.ai Linear",
    description: "Through Claude's Linear connector.",
    actions: {
      listMyIssues: claude([LINEAR("list_issues")], 'list_issues with assignee "me", excluding completed and canceled'),
      listUpdates: claude([LINEAR("get_notifications")], "get_notifications since the given time"),
      getIssue: claude(
        [LINEAR("get_issue"), LINEAR("list_comments")],
        "get_issue, then list_comments for the discussion",
      ),
      getProject: claude(
        [LINEAR("get_project"), LINEAR("list_projects")],
        "get_project by name (list_projects with a query if the name doesn't resolve)",
      ),
      commentOnIssue: claude([LINEAR("save_comment")], "save_comment on the issue"),
      updateIssue: claude([LINEAR("save_issue")], "save_issue with the issue id and only the fields that change"),
      createIssue: claude(
        [LINEAR("save_issue"), LINEAR("list_issues")],
        "check list_issues for a duplicate, then save_issue without an id (team required)",
      ),
    },
  },
  {
    id: "slack",
    name: "Slack",
    category: "messaging",
    driver: "claude",
    enabled: true,
    predefined: true,
    icon: "slack",
    mcpServer: "claude.ai Slack",
    description: "Through Claude's Slack connector.",
    actions: {
      listMentions: claude(
        [SLACK("slack_search_public_and_private")],
        'slack_search_public_and_private for messages to/mentioning me and DMs since the time (e.g. "to:me after:2026-11-05")',
      ),
      searchMessages: claude(
        [SLACK("slack_search_public_and_private"), SLACK("slack_search_public")],
        "slack_search_public_and_private with the query",
      ),
      readThread: claude(
        [SLACK("slack_read_thread"), SLACK("slack_read_channel")],
        "slack_read_thread for a thread, slack_read_channel for a channel or DM history",
      ),
      findPerson: claude([SLACK("slack_search_users"), SLACK("slack_read_user_profile")], "slack_search_users by name"),
      listMyMessages: claude(
        [SLACK("slack_search_public_and_private")],
        'slack_search_public_and_private with "from:me", recent first',
      ),
      sendMessage: claude(
        [SLACK("slack_send_message"), SLACK("slack_search_users"), SLACK("slack_search_channels")],
        "slack_send_message to the user/channel id (thread_ts for a thread reply)",
      ),
    },
  },
  {
    id: "notion",
    name: "Notion",
    category: "docs",
    driver: "claude",
    enabled: true,
    predefined: true,
    icon: "notion",
    mcpServer: "claude.ai Notion",
    description: "Through Claude's Notion connector.",
    actions: {
      search: claude([NOTION("notion-search")], "notion-search with the query"),
      readPage: claude([NOTION("notion-fetch")], "notion-fetch with the page id or URL"),
      createPage: claude([NOTION("notion-create-pages")], "notion-create-pages (a private draft unless told where)"),
    },
  },
  {
    id: "buildkite",
    name: "Buildkite",
    category: "ci",
    driver: "claude",
    enabled: true,
    predefined: true,
    icon: "buildkite",
    mcpServer: "claude.ai buildkite",
    description: "Through Claude's Buildkite connector.",
    actions: {
      getBuildStatus: claude(
        [BK("list_builds"), BK("get_build"), BK("user_token_organization")],
        "user_token_organization for the org, then list_builds for the branch",
      ),
      getFailureSummary: claude(
        [BK("get_build_failure_summary"), BK("user_token_organization")],
        "get_build_failure_summary with org and build number",
      ),
      retryBuild: claude([BK("retry_failed_jobs")], "retry_failed_jobs on the build"),
    },
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    driver: "claude",
    enabled: false,
    predefined: true,
    icon: "calendar",
    mcpServer: "claude.ai Google Calendar",
    description: "Through Claude's Google Calendar connector (authorize it in claude.ai first).",
    actions: {
      listEvents: claude(["mcp__claude_ai_Google_Calendar"], "list today's events from the primary calendar"),
      createEvent: claude(["mcp__claude_ai_Google_Calendar"], "create the event on the primary calendar"),
    },
  },
];
