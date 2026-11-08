# MeatDeck

MeatDeck is a local macOS app for the human side of agent-driven work: where each project stands, what's waiting on you, and who you need to talk to. An Electron shell runs a local Node backend (`server/`) and a React UI (`web/`). Claude Code does the reading and writing on a schedule through MeatDeck's MCP server (`mcp/`).

These are good defaults, not laws. The maintainer's instructions override anything here.

## Glossary

- **user** means the person whose dashboard this is. **you** means the agent changing this code.
- **run** means one `claude -p` invocation started by MeatDeck (morning brief, pulse, wrap-up, send, revise).
- **chat** means a conversation in the composer, on any provider (Claude Code, Codex, Cursor).
- **doc** means what the code and storage still call a note (`N-12`). **ref** means a readable id like `T-45`.
- **integration** means how one category (code, issues, messaging, docs, calendar, CI) is reached: built-in code, CLI, HTTP or a Claude connector.
- **action** means a row in the ranked queue (`shared/actions.ts`), not an integration action.

## The three ways to hurt the user

1. **Writing to their live data.** `~/.meatdeck/` is the user's real dashboard, in use while you work. Read it to understand a bug, never write to it, and never start a second backend against it. Point `MEATDECK_HOME` at a scratch folder for experiments; tests already do (`vitest.config.ts`).
2. **Sending as them.** Drafts go out under the user's name to real people. Never trigger a send, a `gh pr comment` or a messaging tool while testing. Scheduled runs only draft.
3. **Killing by pattern.** The installed app and its backend may be running. Don't `pkill -f` anything you didn't start. Restarting the app belongs to `scripts/install.sh` and the updater (`server/updates.ts`).

## Verifying

- `pnpm check` runs what CI runs: format, lint, typecheck, knip and tests. Run it before you push. `pnpm fmt` fixes formatting.
- Lint runs with `--deny-warnings`. Fix the code instead of disabling a rule; when a suppression is truly right, scope it to one line or block and give the reason after `--`.
- Test behavior that can break: parsers (Markdown, `@due`, CLI streams), matching and ranking rules, state transitions in `reconcile.ts`, version and update logic. Skip tests for what types already guarantee, copy text and static markup.
- Tests are table-driven `it.each` beside the code (`foo.ts` → `foo.test.ts`). Extend an existing table before writing a new `it`. Pass `now` explicitly instead of reading the clock.
- Bug fixes in logic get a failing test first. Visual fixes get before/after screenshots in the PR instead.

## Code first, Claude last (token budget rule)

Every Claude run spends the user's tokens. **Before using Claude for any part of a feature, check whether plain code can do it.** Use Claude only for the parts that need judgment or language. Apply this to every new feature and every change.

Use plain code (no tokens) for anything:

- **fetchable with a CLI or API we already have locally.** `gh` for PRs, reviews, checks, comments and merges; `git`; `date`; macOS tools (`ioreg`, `osascript`); local files.
- **deterministic.** State transitions (PR merged → close its todos), diffs between snapshots, counts, sorting, dedupe, time math, scheduling, formatting, templated text.
- **detectable as "nothing changed".** Don't wake Claude to discover that. Diff in code, and only call Claude when there's something to judge.
- **a row's own "done" signal.** Every action must leave the list on its own once it's done, by code: CI rows read the latest run of each check (gh), a sent message moves its row to "their move" (`sent` log in `shared/actions.ts`), and after you act MeatDeck polls GitHub every minute for a while (`watchClosely` in `server/githubPolling.ts`). A new kind of action needs a cheap watcher like these, not a Claude run.
- **sendable without composing.** A GitHub comment whose text the user already approved goes out through `gh pr comment`, not through a Claude run.

Use Claude for:

- sources we can't reach without its connectors: Slack, Linear, Notion, Calendar. The app deliberately holds no tokens for them.
- judgment: what matters today, who's blocked on whom, whether a thread still needs a reply.
- writing in the user's voice: briefs and drafted messages.

When Claude does run, make it cheap:

- **Hand it facts instead of making it fetch them.** Pre-compute in the server and put the result in the prompt (date, last-run times, GitHub digest, changes since the last run). Every tool call re-sends the whole context, so a fetch Claude skips saves more than its own output.
- **Keep MCP responses compact.** Use minified JSON with only the fields Claude acts on. Never include logs, run history or raw API payloads. Write tools return ids, not the full objects.
- **Pick the smallest model that does the job.** Pulse checks default to Haiku; the morning brief uses the default model.
- **Don't run when nobody's looking.** Skip scheduled pulses while the Mac is idle or locked.
- **Use narrow tool allowlists** (`server/claude/allowlists.ts`). That's for safety, and it also stops Claude wandering into expensive exploration.

When adding a feature, say in the PR or summary which parts are plain code and which use Claude, and why.

## Layout

- `server/`: backend, one concern per file, grouped in feature folders. `index.ts` is startup wiring only (Hono app, middleware, pollers, timers); each resource's HTTP routes live in `routes/<resource>.ts` (`register…Routes(app)`), with `dashboard.ts` (state snapshot, server-side action queue), `changes.ts` (the UI's change signal) and `githubPolling.ts` (adaptive gh polling). `github.ts` (gh poller), `reconcile.ts` (deterministic GitHub → todos/items/messages), `digest.ts` (compact facts for Claude), `scheduler.ts`, `claude/` (Claude runs: `runQueue.ts` the queue and the `claude -p` process, `jobs.ts` what each run kind is, `allowlists.ts` tool allowlists and run env, `runContext.ts` digest/rules/voice added to prompts, `streamEvents.ts` stream-json parsing, per-run usage and Claude limit windows from the stream it already reads), `usage.ts` (token totals from local `~/.claude/projects` transcripts: incremental, no tokens), `store/` (`store.ts` is the `store` object over `state.json`; it delegates to one module per entity, e.g. `todos.ts`, `notes.ts`, `projects.ts`, `rules.ts`; `persistence.ts` loads/saves and exports `DATA_DIR`, `helpers.ts` has `localDate`/`NotFound`). `chat/` (the composer: one Claude Code session per chat, `--session-id`/`--resume`, streamed over SSE, fully capable allowlist by the user's choice; `chatStore.ts` chats on disk and events, `sendChat.ts` entry point, `claudeTurn.ts`/`providerTurn.ts` a turn per provider, `pageContext.ts` page context built in code, `prompts.ts` system prompt and slash commands, `replyParts.ts` the reply timeline and cards), `markdown.ts` (Markdown → doc editor JSON, so Claude can create real docs; `normalizeTasks` turns "1. [ ]" lists into checkboxes on every save), `notes.ts` (checkboxes → todos, @due parsing). `lookup.ts` (readable ids N-12/P-3/T-45/D-7/I-9/R-2/C-5 → readable text, plus search; exposed as the MCP tools `lookup`/`search`, so any Claude session, e.g. T3 Code, can read MeatDeck by id; new entities get ids from `store.nextRef()`). `permissions.ts` (tools outside a run's allowlist ask the user via `--permission-prompt-tool mcp__meatdeck__approve_permission` instead of failing; only for runs the user started). Rules (`store.rules()`) go into every run via `rulesBlock()` (`claude/runContext.ts`); `ignore_check` rules are enforced in code in `github.ts` (per-check CI results).
- `shared/integrations.ts` (+ `shared/integrationPresets.ts`, the shipped integrations) + `server/integrations.ts`: categories (code, issues, messaging, docs, calendar, CI) with fixed actions; integrations implement them via built-in code, CLI, HTTP (Keychain secrets) or Claude connectors. Never call a service directly from a feature: call the category action (`runAction`, `provider`, `senderFor`). Claude allowlists and the prompt's "how to reach each service" block are derived from enabled integrations.
- `shared/providers.ts` + `server/providers/`: agent providers (Claude Code, Codex, Cursor), T3 Code style. Probes cost no tokens: `--version`, Claude's stream-json `initialize` control request (models + account), `codex app-server` `model/list` + `account/read`, `cursor-agent status`/`models`. Cached in `~/.meatdeck/providers.json`, re-probed at start and every 6h (`registry.ts`; one file per provider: `claude.ts`, `codex.ts`, `cursor.ts`, sharing `cliProbe.ts` and `agentTurn.ts`). Chat can run on any ready provider (`runOther` in `server/chat/providerTurn.ts`; `turnCommand`/`turnParser` in `registry.ts` normalize each CLI's stream, with MeatDeck's MCP injected via `-c mcp_servers.meatdeck…` for Codex and `~/.meatdeck/.cursor/{mcp,cli}.json` for Cursor). Scheduled runs, sends and integration actions stay on Claude: they need its skills and claude.ai connectors.
- `shared/projects.ts`: repos vs. projects. Matching rules (ticket keys, channels, keywords, Linear projects, dedicated repos) that Claude learns once and code applies to every PR, item, todo and draft. Also the hide logic. Used by both the server and the UI.
- `mcp/index.ts`: the MCP server Claude uses; its tools are registered per area in `mcp/tools/<area>.ts`, all calling the local server through `mcp/api.ts`. `skill/today/SKILL.md`: the playbook for scheduled runs.
- Docs: the UI and everything Claude reads call them **docs** (MCP tools `create_doc`/`update_doc`/`append_to_doc`/`get_doc`, digest `docsChanged`/`docsOlder`). Code, API routes (`/api/notes`), storage and refs (`N-12`) still say note, on purpose: renaming those would break stored data and existing references. Each doc can have an emoji `icon` (picker: `web/src/components/docs/DocIconPicker.tsx`, frimousse with Emojibase data served from `/emojibase`, so it works offline).
- Chat UI: everything lives in `web/src/components/chat/`. The page is `ChatView.tsx`; turns render with `AssistantTimeline.tsx`/`UserMessageRow.tsx` and their parts (`TimelineWorkGroup`, `WorkEntryRow`, `WorkLog`…), ported from T3 Code's chat timeline (MIT, attribution in the header of each ported file). Replies are stored as ordered `parts` (text + tool calls with status/timing) by `server/chat/replyParts.ts`, so the timeline shows them in order.
- `desktop/`: Electron shell. `web/`: React UI. Components live in feature folders under `web/src/components/` (one component per file; pure logic in a sibling `<Component>.logic.ts` with its test), hooks in `web/src/hooks/`. Settings are pages (`web/src/components/settings/SettingsView.tsx`; one file per section, e.g. `GeneralSettings.tsx`, `ScheduleSettings.tsx`). A new setting needs an entry in `STATIC` in `settings/settingsSearch.tsx`, with a DOM `id` to jump to, so search finds it.
- Ship changes with `./scripts/install.sh`, which rebuilds and reinstalls `/Applications/MeatDeck (Alpha).app`.
- Updates (`server/updates.ts`, `shared/fingerprint.ts`): the build records where its updates come from in `dist-electron/build.json`. Source builds (install.sh) compare file hashes with their source folder and rebuild via install.sh; release builds (`scripts/release.sh`, signed and notarized, published by `.github/workflows/release.yml` on a `v*` tag) read GitHub's latest release and install it after checking the SHA-256 and code signature. The ↑ button is `web/src/components/sidebar/UpdateButton.tsx`. Relaunch rules learned the hard way: never pass `ELECTRON_RUN_AS_NODE` to `open` (the app starts as plain Node and exits), and wait for the old app and backend to exit first (single-instance lock). See `RELEASING.md`.
- pnpm only accepts packages older than about 30 days, so don't pin brand-new versions.
