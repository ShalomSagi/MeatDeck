// Integrations: MeatDeck's features call *actions* of a *category* ("messaging.sendMessage"),
// never a service directly. An integration is one service in one category plus how it performs
// each action: MeatDeck's own code (built-in), a CLI command, an HTTP API, or Claude with a
// connector the user already has. New services = a new integration, no code changes.

export type CategoryId = "code" | "issues" | "messaging" | "docs" | "calendar" | "ci";
export type Driver = "builtin" | "cli" | "http" | "claude";

export interface ActionSpec {
  id: string;
  label: string;
  description: string;
  mode: "read" | "write";
  inputs: { name: string; description: string; example?: string }[];
  /** What a CLI/API implementation must return. */
  returns: string;
  /** Where MeatDeck uses it, shown in the UI. */
  usedBy: string;
}

export interface CategorySpec {
  id: CategoryId;
  label: string;
  description: string;
  actions: ActionSpec[];
}

export const CATEGORIES: CategorySpec[] = [
  {
    id: "code",
    label: "Code hosting",
    description:
      "Pull requests, reviews, merges. Polled by code every 5 minutes, so these should be CLI, API or built-in (not Claude).",
    actions: [
      {
        id: "listMyPullRequests",
        label: "List my open PRs",
        description: "Open PRs I authored, with review and CI state.",
        mode: "read",
        inputs: [],
        returns:
          'JSON array of {url, number, repo ("owner/name"), title, author, isDraft, createdAt, updatedAt, reviewDecision, checks, mergeable, pendingReviewers[], approvedBy[], changesRequestedBy[], unresolvedThreads}',
        usedBy: "Action queue, PR page, auto todos (every 5 min, no tokens)",
      },
      {
        id: "listReviewRequests",
        label: "List review requests",
        description: "Open PRs where my review is requested.",
        mode: "read",
        inputs: [],
        returns: "Same shape as List my open PRs",
        usedBy: "Review rows in the queue",
      },
      {
        id: "getPullRequestState",
        label: "Get PR state",
        description: "Whether a PR is open, merged or closed.",
        mode: "read",
        inputs: [{ name: "url", description: "PR URL", example: "https://github.com/acme/app/pull/12" }],
        returns: 'Text: "OPEN", "MERGED" or "CLOSED"',
        usedBy: "Closing todos when a PR merges",
      },
      {
        id: "readPullRequestComments",
        label: "Read PR comments",
        description: "Review comments and discussion on a PR, so drafts and todos can say what reviewers asked.",
        mode: "read",
        inputs: [{ name: "url", description: "PR URL" }],
        returns: "Text",
        usedBy: "Morning brief, drafting",
      },
      {
        id: "mergePullRequest",
        label: "Merge a PR",
        description: "Merge with the repo's allowed method.",
        mode: "write",
        inputs: [{ name: "url", description: "PR URL" }],
        returns: "Anything (success = exit 0 / 2xx)",
        usedBy: "Merge button",
      },
      {
        id: "rerunFailedChecks",
        label: "Re-run failed checks",
        description: "Re-run the failed CI jobs on a PR.",
        mode: "write",
        inputs: [{ name: "url", description: "PR URL" }],
        returns: "Anything (success = exit 0 / 2xx)",
        usedBy: "Re-run button",
      },
      {
        id: "commentOnPullRequest",
        label: "Comment on a PR",
        description: "Post an approved comment.",
        mode: "write",
        inputs: [
          { name: "url", description: "PR URL" },
          { name: "body", description: "Comment text" },
        ],
        returns: "Anything",
        usedBy: "Send on GitHub drafts",
      },
      {
        id: "listMyComments",
        label: "List my comments",
        description: "My recent comments, as writing samples.",
        mode: "read",
        inputs: [],
        returns: "JSON array of strings, or one comment per line",
        usedBy: "Learning your voice",
      },
    ],
  },
  {
    id: "issues",
    label: "Issue tracker",
    description: "Tickets and projects.",
    actions: [
      {
        id: "listMyIssues",
        label: "List my issues",
        description: "Open issues assigned to me, with status, priority and due date.",
        mode: "read",
        inputs: [],
        returns: "JSON or text",
        usedBy: "Morning brief, tracked items",
      },
      {
        id: "listUpdates",
        label: "List updates",
        description: "Mentions, comments and status changes on my issues since a time.",
        mode: "read",
        inputs: [{ name: "since", description: "ISO time" }],
        returns: "JSON or text",
        usedBy: "Morning brief, pulse",
      },
      {
        id: "getIssue",
        label: "Get an issue",
        description: "One issue with its discussion.",
        mode: "read",
        inputs: [{ name: "id", description: "Issue key", example: "ENG-123" }],
        returns: "JSON or text",
        usedBy: "Drafting, chat",
      },
      {
        id: "getProject",
        label: "Get a project",
        description: "A project's description, lead and dates.",
        mode: "read",
        inputs: [{ name: "name", description: "Project name" }],
        returns: "JSON with description and url, or text",
        usedBy: "Project descriptions (synced weekly)",
      },
      {
        id: "commentOnIssue",
        label: "Comment on an issue",
        description: "Post an approved comment.",
        mode: "write",
        inputs: [
          { name: "id", description: "Issue key" },
          { name: "body", description: "Comment" },
        ],
        returns: "Anything",
        usedBy: "Send on issue drafts",
      },
      {
        id: "updateIssue",
        label: "Update an issue",
        description: "Change status, assignee, priority or text.",
        mode: "write",
        inputs: [
          { name: "id", description: "Issue key" },
          { name: "changes", description: "What to change" },
        ],
        returns: "Anything",
        usedBy: "Chat",
      },
      {
        id: "createIssue",
        label: "Create an issue",
        description: "File a new ticket.",
        mode: "write",
        inputs: [
          { name: "title", description: "Title" },
          { name: "description", description: "Body" },
        ],
        returns: "The new issue key or URL",
        usedBy: "Chat",
      },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "Conversations with people.",
    actions: [
      {
        id: "listMentions",
        label: "List mentions & DMs",
        description: "Messages that mention me or DM me since a time.",
        mode: "read",
        inputs: [{ name: "since", description: "ISO time" }],
        returns: "JSON or text",
        usedBy: "Morning brief, pulse",
      },
      {
        id: "searchMessages",
        label: "Search messages",
        description: "Find messages by words, person or channel.",
        mode: "read",
        inputs: [{ name: "query", description: "Search query" }],
        returns: "JSON or text",
        usedBy: "Brief, nudges (does a conversation continue in DM?)",
      },
      {
        id: "readThread",
        label: "Read a thread",
        description: "All replies in a thread or a DM history.",
        mode: "read",
        inputs: [
          { name: "conversation", description: "Channel/DM id" },
          { name: "thread", description: "Thread id (optional)" },
        ],
        returns: "JSON or text",
        usedBy: "Judging whether a reply is still owed",
      },
      {
        id: "findPerson",
        label: "Find a person",
        description: "Look up someone's id by name.",
        mode: "read",
        inputs: [{ name: "name", description: "Name" }],
        returns: "JSON or text with their id",
        usedBy: "Retargeting drafts (e.g. to a DM)",
      },
      {
        id: "listMyMessages",
        label: "List my messages",
        description: "Messages I wrote recently, as writing samples.",
        mode: "read",
        inputs: [],
        returns: "JSON array or one per line",
        usedBy: "Learning your voice",
      },
      {
        id: "sendMessage",
        label: "Send a message",
        description: "Send approved text to a person, channel or thread.",
        mode: "write",
        inputs: [
          { name: "target", description: "Person/channel id" },
          { name: "text", description: "Message" },
          { name: "thread", description: "Thread id (optional)" },
        ],
        returns: "Anything",
        usedBy: "Send button",
      },
    ],
  },
  {
    id: "docs",
    label: "Docs & knowledge",
    description: "Pages, wikis and documents.",
    actions: [
      {
        id: "search",
        label: "Search",
        description: "Find pages by words.",
        mode: "read",
        inputs: [{ name: "query", description: "Query" }],
        returns: "JSON or text with titles and links",
        usedBy: "Chat, project discovery",
      },
      {
        id: "readPage",
        label: "Read a page",
        description: "A page's content.",
        mode: "read",
        inputs: [{ name: "id", description: "Page id or URL" }],
        returns: "Text",
        usedBy: "Chat, project discovery",
      },
      {
        id: "createPage",
        label: "Create a page",
        description: "Write a new page.",
        mode: "write",
        inputs: [
          { name: "title", description: "Title" },
          { name: "markdown", description: "Content" },
        ],
        returns: "The new page URL",
        usedBy: "Chat",
      },
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Meetings and time.",
    actions: [
      {
        id: "listEvents",
        label: "List events",
        description: "Meetings between two times.",
        mode: "read",
        inputs: [
          { name: "from", description: "ISO time" },
          { name: "to", description: "ISO time" },
        ],
        returns: "JSON or text",
        usedBy: "Morning brief (todos around meetings)",
      },
      {
        id: "createEvent",
        label: "Create an event",
        description: "Book a meeting.",
        mode: "write",
        inputs: [
          { name: "title", description: "Title" },
          { name: "when", description: "Time" },
          { name: "attendees", description: "People" },
        ],
        returns: "Anything",
        usedBy: "Chat",
      },
    ],
  },
  {
    id: "ci",
    label: "CI",
    description: "Build pipelines and failures.",
    actions: [
      {
        id: "getBuildStatus",
        label: "Get build status",
        description: "The latest build for a branch or PR.",
        mode: "read",
        inputs: [{ name: "ref", description: "Branch or PR URL" }],
        returns: "JSON or text",
        usedBy: "Fix-CI rows, chat",
      },
      {
        id: "getFailureSummary",
        label: "Explain a failure",
        description: "Why a build failed, with log excerpts.",
        mode: "read",
        inputs: [{ name: "build", description: "Build URL or id" }],
        returns: "Text",
        usedBy: "Fix-CI rows, chat",
      },
      {
        id: "retryBuild",
        label: "Retry a build",
        description: "Re-run failed jobs.",
        mode: "write",
        inputs: [{ name: "build", description: "Build URL or id" }],
        returns: "Anything",
        usedBy: "Chat",
      },
    ],
  },
];

export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;
export const actionSpec = (cat: CategoryId, action: string) => categoryOf(cat).actions.find((a) => a.id === action);

export type ActionImpl =
  | { kind: "builtin" }
  | { kind: "none" }
  /** Shell command; {{name}} placeholders are shell-quoted. */
  | { kind: "cli"; command: string; output: "json" | "text" }
  /** HTTP request; {{name}} in url/body, {{secret:NAME}} reads the macOS Keychain. `pick` = dot path into the JSON. */
  | {
      kind: "http";
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      url: string;
      headers?: Record<string, string>;
      body?: string;
      output: "json" | "text";
      pick?: string;
    }
  /** Claude does it: `tools` it may use (allowlist entries), `how` = one line on which tool and how. */
  | { kind: "claude"; tools: string[]; how: string };

export interface Integration {
  id: string;
  name: string;
  category: CategoryId;
  driver: Driver;
  enabled: boolean;
  /** Shipped with MeatDeck (editable, not deletable). */
  predefined?: boolean;
  /** Icon key: github, linear, slack, notion, buildkite, calendar, or a generic one. */
  icon?: string;
  description?: string;
  /** Claude driver: the MCP server name, e.g. "claude.ai Slack" (used for status). */
  mcpServer?: string;
  /** Names of secrets (stored in the Keychain) this integration's API templates use. */
  secrets?: string[];
  actions: Record<string, ActionImpl>;
}

export interface IntegrationStatus {
  state: "ok" | "warning" | "error" | "off";
  text: string;
}
