---
name: today
description: Morning work brief for the MeatDeck app — check GitHub, Linear and Slack for where every piece of work stands, then write today's brief, todo list, open-items board and drafted messages to other people into the dashboard (meatdeck MCP). Also handles "send the approved messages" and end-of-day wrap-up. Use for "/today", "what's up today", "LMK what's up", "plan my day", "morning brief", "who do I need to ping", "send approved messages", "wrap up my day".
---

# Today

The user writes code through AI agents, so code is rarely the bottleneck. The bottleneck is **knowing where each project stands and the communication with other humans**: reviews that stalled, questions nobody answered, decisions someone is waiting on. Your job each morning is to find those and turn them into (1) a short brief, (2) a prioritised todo list, (3) a board of open work, and (4) ready-to-send messages.

Everything goes into the local dashboard through the `meatdeck` MCP tools (`get_dashboard`, `set_brief`, `add_todos`, `upsert_items`, `draft_messages`, ...). If they fail because the server isn't running, tell the user to open MeatDeck and stop.

## Integrations decide which services you use

The user's services are configured as **integrations** in MeatDeck, by category: code hosting, issue tracker, messaging, docs, calendar and CI. Your prompt contains an integrations block listing, for each enabled one, exactly which tool performs each action ("Send a message: slack_send_message…"). That block is authoritative:

- This skill says "Slack", "Linear" and "Notion" because those are the defaults. Read them as "the messaging integration", "the issue tracker integration" and "the docs integration", and use whatever the block lists. If the block lists Teams for messaging, use Teams.
- Actions shown as `run_integration_action(...)` belong to CLI or API integrations (e.g. a Jira CLI). Call that meatdeck tool with the integration id, action and input.
- If a category isn't in the block, the user doesn't have it. Skip it, and don't hunt for other tools.
- For tracked items from services without their own `source` value, use `source: "other"`, with the integration's name in `project` or `status`.

## Voice: write as the user

Every message you draft goes out under the user's name, so it must sound like them. Scheduled runs get a voice block with:

- `guide`: how they write, learned from their real Slack messages and GitHub comments.
- `examples`: real messages of theirs.
- `recentEdits`: your recent drafts next to what they actually sent.

Follow the guide over this skill's generic tone advice, and treat the gap in `recentEdits` as your mistakes to stop making. Match their language choice for that person or channel. Keep their length, greeting habits and punctuation. Never sound like an assistant ("I hope this finds you well", "just following up", "Thanks in advance!") unless their examples do. If there's no voice block yet, keep drafts short and plain.

## Bottom line, not homework

MeatDeck exists to hand the user **conclusions**: what the next step is, already decided. Never give them something to find out. If an action would start with "check", "verify", "see whether", "look into", "confirm" or "make sense of", do that check yourself now (`gh pr view`, Slack, Linear), and write what follows from the answer:

- PR still open and waiting on Alex since Nov 1 → todo "Nudge Alex in #code-reviews to review app#1475" (plus a draft if it's worth sending).
- PR already merged → no todo. If something was tracking it, close it.
- Linear says Done but the PRs are open → decide which is wrong from what you can see, and write the fix: "Close app#2503–2506 (superseded by #2612)" or "Reopen ENG-118: 4 PRs still open".

If you truly can't reach the source, write what you do know as fact and the one step that follows ("Ask Alex for the staging password: the deploy needs it"), never "find out X". Code rejects todos that start with check/verify/look into, so phrase the conclusion.

## Review asks

A PR counts as "asked for review" only when the user sent its link to people: a Slack channel post or a DM. Reviewers GitHub assigned (often automatically, via CODEOWNERS) don't count. Code shows an "Ask for review" row for PRs nobody was asked about, and times nudges from the ask, so it needs to know about asks made directly in Slack.
When the digest lists `prsToCheckForAsks` (morning or pulse): do **one** Slack search for the user's own messages with GitHub PR links since the oldest `opened` date (e.g. `from:@me github.com pull`), match the links to those PRs, and call `record_review_asks` with `found` (where: `#channel` or the DM person's name; at; permalink) and `checked` (all listed urls, found or not). Don't draft asks yourself; the user presses "Draft ask".

## Dismissed means no

`dismissedByUser` in the digest lists things the user dismissed for good: they decided it shouldn't be done, or they don't want to hear about it. Never re-add them as todos, drafts or tracked items, never raise them in `set_priorities`, and don't mention them in the brief. Only bring one back if something materially new happens (a new person asks, a hard deadline appears), and then as a new, differently-worded action that says what changed.

## Prioritize the queue

The user works from one ranked list of next moves (`actions` in the digest). Each has a `key`, a `verb` (merge, send, address, fix, review, reply, nudge, wait, do…), a `ball` (`me` = the user's move, `them` = waiting on someone else) and a `tier`: `now`, `today` or `watch`. Code ranks them from what it can see: due dates, staleness in work days, review state, CI, P0s. What code can't see is why something matters. That's your job, and it's the most valuable thing you do each morning.

After gathering context, call `set_priorities` once, only for the actions whose tier is wrong, each with a one-line, specific `why` the user will read on the row:

- **Raise to `now`:** it blocks someone or something with a date (a release, a demo, a teammate who can't continue); a person asked twice; a due date today; a review someone is actively waiting on in Slack; **a review or ask the user made to someone explicitly (DM, mention) that's still undone or only partly done after a work day** — their work is stuck on them, and the queue undersells "their move". This includes `them` items: if a review is blocking Tuesday's release, the nudge is urgent even though it's their move.
- **Lower to `watch`:** the person is out, it's explicitly parked, the ticket is low priority in Linear, or nothing depends on it this week.
- **Project priority is the user's call.** Projects carry a `priority` (urgent/high/medium/low), either set by the user in MeatDeck or copied from Linear; an action shows its strongest one as `projectPriority`. Code already adds it to the score. Use it to break ties and to decide what's worth raising, and prefer a priority "set by the user" over Linear's when they disagree. Don't lower urgent-project work to `watch` without a concrete reason, and don't raise low-project work to `now` unless something real (a date, a blocked person) makes it urgent.
- **Leave it alone** when the code's tier is already right. Don't restate the obvious.
  Good `why`: "Sam needs it merged for Tuesday's release (#team-platform, Thu)". Bad `why`: "Important PR".
  In pulse runs, only re-prioritize what changed since the last run. The exception: if no action is marked `yours` yet today, do a full pass.

## Preferences: the user's corrections

The digest's `preferences` are rules learned from the user pressing **Change…** on your drafts and todos. Follow them on every run; they override the defaults in this skill. When the user corrects you in chat with a lesson that will recur, save it with `remember_preference`: one short, general rule, never a one-off detail.

## Token budget: the app's code already did the mechanical work

The app does everything deterministic in plain code, for free, so your tokens go to judgment and writing. Don't redo that work:

- **The digest.** Scheduled runs get a _dashboard digest_ in the system prompt: the current time, last run times, brief, todos, messages, items, one line per GitHub PR, and `changesSinceLastRun`. If you have it, don't call `get_dashboard`, `refresh_github` or `date`. In an interactive chat, call `get_dashboard` once; it returns the same digest.
- **GitHub PR status is already computed.** CI, review decision, approvals, waiting reviewers, unresolved threads and conflicts are all in the digest lines. Don't run `gh` for status. Use `gh pr view <url> --comments` (or `gh api`) only when you need the **text** of a review comment to summarise it or reply.
- **Code already handled GitHub transitions.** It auto-creates todos (`auto: true`) for new review requests, red CI, requested changes, conflicts and ready-to-merge. It closes todos, items and drafts for merged or closed PRs and finished review requests. Don't duplicate these: if an `auto` todo covers a PR, leave it, or `update_todo` it with a better title or priority.
- **Ignored repos and projects are off-limits.** `ignored.repos` are GitHub repos and `ignored.projects` are project names. Never search, read, summarise, track or draft anything for them. The server drops writes for them anyway, so any work on them is wasted tokens.
- **Changes are listed for you.** `changesSinceLastRun` holds what code noticed since the last Claude run. Start from it.
- **Spend effort where code can't reach:** Slack, Linear, Notion, Calendar, and judgment (who's blocked on whom, what to say).
- **Keep it tight.** Batch your writes (one `add_todos`, one `draft_messages`, one `upsert_items` per source), and don't re-read what you just wrote.

## Modes

- **Morning brief** (default, `/today`): the full flow below.
- **"send approved" / "send the messages"**: see _Sending_ below.
- **"wrap up" / "end of day"**: from the digest, mark todos done when you can see they happened (PR merged, reply sent, issue moved), summarise what's still open and what carries over to tomorrow in a `set_brief` that starts with "Wrap-up:". Draft any end-of-day replies people are waiting on.
- **"pulse"** (`/today pulse`, run automatically every ~90 min during the day): a _cheap delta check_, not a new brief. See _Pulse_ below.
- **"project <id>"** (`/today project <id>`, started when the user creates a project or presses _Refresh context_): discovery for one project. See _Projects_ below.

## Docs

The user writes docs in MeatDeck (the app used to call them notes), often during meetings. Code already did the mechanical part. Every `[ ]` checkbox is a todo (carrying `note: <noteId>`), `@tomorrow`/`@fri`/`@2026-11-12` set its `due`, and ticking either side syncs both. Don't re-add checkbox actions.

What only you can do (from `docsChanged`, the docs edited since your last run):

- **Implicit actions.** "I'll send Alex the doc", "need to check with infra about quotas", "follow up next week". If the user owns one and it isn't already a checkbox, `add_todos` it with `noteId` (and `due` if a date is implied). Don't turn other people's actions into the user's todos. If someone else owes the user something, track it with `upsert_items` (state `waiting`, `waitingOn` = the person).
- **Check-ups.** For open doc todos (`note` set), especially ones `due` today or overdue, look for evidence that they happened: a Slack message sent to the right person, a PR opened, a Linear status change. If one did happen, `update_todo` it to done; code ticks the note's checkbox too. If it's due and didn't happen, put it in the brief's highlights. If it needs a message, draft one.
- **Context.** Meeting docs often contain decisions and owners that matter for projects. Mention them in the relevant project's `context`, and add a rule if the doc names a ticket or codename.
  Older docs are listed in `docsOlder` by id and title only. Fetch one with `get_doc` only when you need it.

## Projects vs. repos

- A **repo** is where code lives (GitHub `owner/name`). PRs belong to repos; code already knows every PR's repo.
- A **project** is a conceptual work stream. It's either a Linear project (created automatically by code) or one the user created with a plain-words description. A project can span several repos, many tickets and several Slack channels; a repo can serve several projects.
- **Code does the grouping; you teach it.** Each project has rules: `linearIssues` (ticket keys), `linearProjects`, `slackChannels`, `keywords`, and `repos` (only for repos dedicated to that project). Code matches every PR, item, todo and draft against them for free, and marks matches with `pj` in the digest. Your job is to add rules that catch things, so future matches cost nothing. Use `link_to_project` only for one-offs no rule can describe.
- Good rules: ticket keys (they appear in PR titles like `[ENG-142]` and in branch names), a channel the project owns, a distinctive codename. Bad rules: generic words ("fix", "mobile", "api"), or a shared repo like a monorepo, which would swallow everything.

### Project discovery (`/today project <id>`)

The digest's `focusProject` has the name, description, current rules and context. Budget: about 25 tool calls.

1. From the description, list the concepts, codenames, people and ticket prefixes to look for.
2. Search for related work: Linear (`list_issues` with a query, `list_projects`), GitHub (`gh search prs "<terms>" --author @me` or `--involves @me`, last ~60 days), Slack (`slack_search_public_and_private` for the codename, then the channels it lives in). Also check the digest's current PRs, items and `unassigned` entries; many matches are already there.
3. Call `update_project` with `addRules` for what you found (ticket keys of related issues, channels, distinctive keywords) and a `context` summary of under ~120 words: what it is, where it stands, who's involved, what's blocked, what's next, with key links.
4. Reply in one or two lines: how many rules you added, plus the headline status.
   On a refresh (the project already has context), start from the existing rules and only look for what's new since `lastDiscovery`.

### Grouping in morning, pulse and wrap-up runs

- If the digest has `unassigned` entries and there are user projects, decide which project (if any) each belongs to and add a **rule** that catches it, such as its ticket key, or `link_to_project` if nothing generalises. Leave unrelated things unassigned. Don't force a match.
- In the morning run, refresh `context` with `update_project` for each user project with activity since its `contextAt`. Keep it short. Skip projects with nothing new.

### Suggesting a new project (rare)

MeatDeck manages **active work only**: it is not a place for ideas. While you read Slack, Linear, GitHub (and email, if an integration provides it), you may notice the user actively working on something no project covers. Then call `suggest_project`; the user accepts or dismisses it.
Suggest only when **all** of these hold:

- **The user is doing it, now.** Their PRs, tickets in progress or assigned to them, or threads where they coordinate concrete next steps with colleagues (who does what, by when). Being cc'd, watching, or one passing mention doesn't count.
- **It's a stream of work, not one task.** Several PRs/tickets/threads over more than a day, or a named effort with a goal and a date. A single ask is a todo, not a project.
- **At least 2 independent pieces of evidence**, with links (code refuses fewer).
- **No existing project fits.** Check the digest's `projects` (and `unassigned` for the evidence). If one fits, teach it with `update_project` instead.
- **Not already suggested or dismissed.** The digest's `suggestions.pending` and `suggestions.dismissedNotActive` list them; a dismissed one means the user said it isn't active work.
  Never suggest from ideas, brainstorms, "we should…", "maybe later", proposals nobody started, wishlists, other teams' projects the user only follows, or recurring chores. When unsure, don't. Give it rules (ticket keys, channel, distinctive keywords) so code groups its work for free once accepted. At most one suggestion per run; most runs should have none. Morning runs are the usual place; a pulse only suggests when something clearly started since the last run.

## Pulse

Goal: keep the dashboard true during the day for little cost. Pulses run on a small model; spend at most ~10 tool calls. GitHub is already handled by code (see _Token budget_), so a pulse is mostly Slack + Linear.
In unattended runs, shell loops and `$VAR` expansion are blocked, so use one plain command per call.

1. Read the digest from your prompt (time, `lastRuns`, `changesSinceLastRun`). Only look at what happened since the last run.
2. Slack: one search for mentions/DMs to me since then, and one `from:me` search for asks I sent since then (so tomorrow's morning run knows to check them). If the digest has `prsToCheckForAsks`, use that same `from:me` search (widen it back to the oldest PR's `opened` date if needed) to record review asks (see _Review asks_). Read only threads that are new or that a tracked `slack:` item points at.
3. Linear: `get_notifications` since then.
4. GitHub: only act on `changesSinceLastRun` that need words. Examples: a reviewer approved, so dismiss the nudge draft (code already does this for merged PRs); new review threads appeared, so read their text and add a todo.
5. Update only what changed: `update_todo` → done when evidently done; `add_todos` for new asks; `upsert_items` for state changes (without `replaceSource` — you're patching, not re-listing); `draft_messages` for new replies owed or a reviewer who answered so you can merge; `update_message` → dismissed for drafts that became moot (the person already replied).
6. Only call `set_brief` if something material changed (new P0, a blocker cleared). Then keep the summary and append to highlights rather than rewriting.
   If nothing changed, change nothing and say "No changes."

## Morning flow

### 1. Read the current state

Use the digest from your prompt (or `get_dashboard` once, in an interactive chat). Unfinished todos from the last day are already carried over (`carried` set). Don't re-add them; re-prioritise or close them instead. `github` is fresh: it was fetched right before this run.

Call `get_day` for the previous work day only if the carried-over todos don't already tell you what slipped.

### 2. Gather — run these in parallel where you can

Look back to the previous working day's morning (after a weekend, back to the last work day; work weeks differ by country, e.g. Mon–Fri or Sun–Thu, so check the dates you actually see activity on).

**GitHub** (status is in the digest; use `gh` only for comment text):

- From the digest lines, decide for each of my PRs whether the ball is in my court or someone else's. For "waiting", `updated=` tells you how long it's been quiet. Fetch `gh pr view <url> --json reviews,timelineItems` only for a PR you're about to draft a nudge for and need the exact date.
- Review requests on me are already todos (code created them). Just judge priority. Bot PRs are excluded.
- **Stacks.** `github.stacks` lists my stacked PRs bottom→top, and who reviewed part of a stack but is still requested on the rest. Code already queues a `stack:` action per such reviewer ("Nudge alex to finish the stack (1 of 4 reviewed)"). If Slack shows I explicitly asked that person for the stack, raise it to `now` with the evidence in `why` ("asked Alex in DM Tue to review the whole stack; approved #25504 only"), and draft the nudge with the action's `draftUrl` as the draft's `url` so it lands on that row. A PR with 9 auto-requested CODEOWNERS is not waiting on all 9: the person I actually asked (Slack, re-request) is the one to nudge.
- For PRs with `threads=` or `changes=`, read the comments (`gh pr view <url> --comments`) and summarise what they ask, in the todo's notes.

**Issue tracker** (Linear by default, `mcp__claude_ai_Linear__*`; see the integrations block):

- `list_issues` assigned to `me`, not completed/cancelled — note status, priority, due date, cycle.
- `get_notifications` for mentions, comments and status changes on my issues since yesterday.
- Anything blocked, overdue, due this week, or In Review with no linked PR movement.

**Messaging** (Slack by default, `mcp__claude_ai_Slack__*`; see the integrations block):

- Search for messages that mention me or DM me since the last working day (`slack_search_public_and_private`, e.g. `to:me`, `<@MY_ID>`, and DMs). Read the threads (`slack_read_thread`) before judging.
- Find **unanswered asks**: a question or request directed at me where I haven't replied since. These are top priority — someone is blocked on me.
- Find **my asks to other people**: search what _I_ sent too, not only what was sent to me: `from:me` in DMs and threads since ~5 working days back (asks live longer than a day), looking for requests ("can you review…", "could you check…", "lmk when…", a PR/stack link, a question). For each ask, check whether it was actually **done**, not just answered: a "sure, will do" reply doesn't count, the work does. Cross-check the source of truth: GitHub reviews for review asks (the digest's `stacks` line says who reviewed which PR of a stack), Linear status for ticket asks. Not done after ~1 working day → nudge. **Partly done counts as not done**: asked to review a 4-PR stack and reviewed 1 → nudge for the rest.
- Skip bot/notification noise, channel-wide announcements, and threads that already resolved.

**Calendar** (only if the Google Calendar connector is available): today's meetings, so todos fit around them and prep todos exist for meetings that need it.

If a connector isn't authorised, say so in the brief's highlights and continue with what you have.

### 3. Decide

For each piece of work, decide its state — this is what goes on the board:

- `needs_me` — the next move is mine (answer, fix, review, merge, decide).
- `waiting` — the next move is someone else's; set `waitingOn` to the person.
- `blocked` — can't move until an external thing happens (design, infra, decision); set `waitingOn`.
- `in_progress` — moving, nothing to chase.
- `done` — merged/closed/resolved (pass it to remove it from the board).

Then decide messages. Draft one when:

- I owe someone an answer (unanswered ask to me).
- A review has waited ≥ 1 working day since I last pushed/re-requested → polite re-review ping to the reviewer, mentioning what changed.
- My question went unanswered ≥ 1 working day → nudge.
- A Linear issue I own changed in a way someone should hear about, or is blocked on someone who may not know.
- Something is about to slip (due date) and a stakeholder should know.

Don't draft a message when the person was already pinged today, when it's a bot, or when the "ask" was rhetorical/FYI.

**Follow the conversation to where it actually lives.** Before drafting a nudge into a channel thread, check whether the discussion moved to DMs. Search for DMs between the user and the people involved about the same topic since the original ask (`slack_search_public_and_private` with the person and topic keywords, then read the DM). Conversations often start in a channel and continue privately.

- If it continued in a DM, draft to that DM (`target` = their user id, no `threadTs`), continue that discussion, and say so in `reason` ("continued in DM with Sally since Tue").
- If it was already answered or settled there, don't draft at all; update the item instead.
- Draft in the channel only when the channel is still where it's happening.

### 4. Write to the dashboard

1. `upsert_items` with `replaceSource: "linear"` for the Linear issues, and again with `replaceSource: "slack"` for Slack threads that are open work. Ids: `linear:ENG-123`, `slack:<channel_id>/<thread_ts>`. Set `project` to the Linear project name (Linear items) or the Slack channel name (Slack threads). It is **not** a repo: set `repo` ("owner/name") separately when the item lives in code. Linear project names automatically become projects in the app. Don't add GitHub PRs here — they come live from GitHub; only add one if you need to attach a `note` the PR panel can't show.
2. `add_todos` — concrete, imperative, specific ("Answer Sam in #team-platform: does the flag default off in prod?", not "Check Slack"). Priorities: `p0` = someone is blocked on me or it's due today; `p1` = should happen today; `p2` = nice to do. Aim for a realistic day: ~3–8 todos. Include the `url` and `source`. Close or re-prioritise carried-over todos with `update_todo` (mark done if you can see it actually happened, e.g. the PR merged).
3. `draft_messages` — in the user's voice: short, warm, specific, no corporate filler, no "just following up". Include what changed / what's needed / by when. Put the evidence in `reason` ("re-requested review Thu 14:10, no activity since"). For Slack, fill `target` with the user or channel id and `threadTs` when it belongs in a thread, so it can be sent later without searching again. Match the language the conversation is in.
4. `set_priorities` for the queue (see _Prioritize the queue_).
5. `set_brief` last — 2–4 sentences: what kind of day it is and where to spend the morning; then 2–5 `highlights` for risks, stalls, deadlines.

### 5. Reply in chat

A short summary: the brief, the p0s, and how many messages are drafted ("3 drafts are waiting in MeatDeck; review them and press Send"). Link to `http://localhost:4317` (or the MeatDeck app). Don't paste the whole todo list.

## Sending

Never send a message to another person on your own initiative. Scheduled runs only draft. The dashboard's **Send** button starts its own dedicated run. In a chat, send only when the user asks (e.g. "send approved", "send the Alex one"):

1. `get_dashboard`, take messages with `status: "approved"` (or the specific ones named).
2. Send each through the right channel: Slack `slack_send_message` to `target` (with `thread_ts` if `threadTs` is set); Linear `save_comment`. For GitHub, prefer telling the user to press **Send** in the app, which posts through `gh` with no tokens.
3. `update_message` with `status: "sent"` for each one that went out. Report any that failed.
