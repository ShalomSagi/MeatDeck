# MeatDeck

_You're the meat proxy: the human who carries messages between the agents and everyone else. This is your deck._

MeatDeck is a local macOS desktop app for the part of the job agents don't do for you: knowing where every project stands, what's waiting on you, and who you need to talk to.

It's for engineers who already write most of their code through AI agents. Code is rarely the bottleneck anymore. The bottleneck is the people: reviews that stalled, questions nobody answered, decisions someone is waiting on. MeatDeck finds those and hands you a short brief, a ranked list of next moves, and messages drafted in your voice, ready to send.

Claude Code does the reading and writing, on a schedule, using the connectors you already have (Slack, Linear, Notion, Buildkite, GitHub through `gh`, Calendar once authorised). The app itself is plain code: it holds the dashboard, tracks GitHub on its own, and only wakes Claude when there's something to judge. Styled after and built like [T3 Code](https://github.com/pingdotgg/t3code).

```
                    MeatDeck (Alpha).app (Electron)
 ┌──────────────────────────────────────────────────────────┐
 │ main process ── window (frameless, T3-style title bar)   │
 │      │ spawns (ELECTRON_RUN_AS_NODE)          ▲ HTTP+SSE │
 │      ▼                                        │          │
 │ backend :4317 (127.0.0.1) ────────────────────┘          │
 │   ├─ scheduler ─► `claude -p /today …` (read-only tools) │
 │   ├─ Send click ─► `claude -p` (send tools, that message)│
 │   ├─ chat ─► Claude Code · Codex · Cursor                │
 │   ├─ gh poller (live PR status every 5 min)              │
 │   ├─ update check (GitHub Releases)                      │
 │   └─ ~/.meatdeck/state.json                              │
 └──────────────▲───────────────────────────────────────────┘
                │ meatdeck MCP (stdio, bundled in the app)
        Claude Code ── Slack · Linear · Notion · Buildkite · gh …
```

## Requirements

- macOS on Apple Silicon.
- [Claude Code](https://docs.claude.com/en/docs/claude-code), installed and logged in. Its claude.ai connectors (Slack, Linear, Notion, Calendar…) are how MeatDeck reaches those services.
- [GitHub CLI](https://cli.github.com) (`gh`), logged in.
- Optional: the Codex CLI and the Cursor CLI (`cursor-agent`), if you want to chat with those too.

## Install

1. Download [`MeatDeck-mac-arm64.dmg`](https://github.com/ShalomSagi/MeatDeck/releases/latest/download/MeatDeck-mac-arm64.dmg) from the [latest release](https://github.com/ShalomSagi/MeatDeck/releases/latest).
2. Open it and drag `MeatDeck (Alpha).app` onto `Applications`.
3. Open the app from `/Applications`.

Releases are signed and notarized by Apple, so the app opens normally.

First launch turns on _Open at login_ (it starts in the background, so the morning brief is ready before you open it), registers the `meatdeck` MCP server with Claude Code, and installs the `/today` skill.

Closing the window keeps the app running in the background, the way T3 Code behaves. Use ⌘Q to quit.

## Updates

The app checks GitHub Releases a few times a day. When there's a new version, a small **↑** button shows up in the sidebar footer. Click it to install the update and restart.

Builds from source update from their own folder instead: when the files there change (say, after a `git pull`), the same button rebuilds and reinstalls the app.

## Build from source

You need Node.js and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/ShalomSagi/MeatDeck.git
cd MeatDeck
./scripts/install.sh     # builds MeatDeck (Alpha).app, installs it to /Applications, launches it
```

`./scripts/uninstall.sh` reverses everything except your data in `~/.meatdeck/`.

For development:

```sh
pnpm dev          # backend :4317 (watch) + Vite :5173 with HMR, in the browser
pnpm desktop      # build and run the Electron app from source
pnpm check        # format, lint, typecheck, unused code, tests (what CI runs)
pnpm test         # tests only
```

| Path                   | What                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `desktop/`             | Electron main + preload: spawns the backend, window chrome, login item, dock badge, first-run Claude setup |
| `server/`              | Hono backend: JSON store, REST + SSE, scheduler, Claude run queue, `gh` poller, updates                    |
| `mcp/index.ts`         | stdio MCP server Claude uses to read and write the dashboard                                               |
| `web/`                 | React + Tailwind v4 UI using T3 Code's tokens                                                              |
| `skill/today/SKILL.md` | The playbook for morning / pulse / wrap-up / sending                                                       |
| `scripts/`             | Build, install and release scripts                                                                         |

Contributors: read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) first. `AGENTS.md` has the layout in detail and the rules every change follows. Releases (signing, notarization, publishing) are described in [`RELEASING.md`](RELEASING.md).

## What runs on its own

| Run               | When                                                | What Claude does                                                                                      |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Morning brief** | Work days from 08:30; catches up when the Mac wakes | Full `/today`: GitHub, Linear, Slack → brief, todos, board, drafted messages                          |
| **Pulse check**   | Every 90 min, 09:30–18:30, once the brief exists    | Cheap delta: new mentions and replies, PR state changes, closes finished todos, dismisses moot drafts |
| **Wrap-up**       | Off by default (18:30)                              | Closes what got done, lists what carries over, drafts replies you still owe                           |

Work days follow your Mac's region: Mon–Fri in most places, Sun–Thu where the weekend is Friday and Saturday. Dates you type like `@11/12` follow it too.

Change all of this on the **Automation** page, which also has _Run now_ and the log of every run. A desktop notification fires when an unattended run finishes. The dock badge counts P0 todos plus messages waiting for you.

You can still type `/today`, "what's up today" or "wrap up my day" in any Claude Code session. Those runs fill the same dashboard.

## Privacy and safety

- **Everything stays on your Mac.** Your dashboard lives in `~/.meatdeck/`. There's no MeatDeck server and no telemetry. The only outside calls the app makes itself are `gh`, the update check, and any HTTP integrations you add.
- **The app holds no tokens.** Slack, Linear, Notion and Calendar are reached through Claude Code's own connectors. GitHub goes through your `gh` login. Secrets for custom HTTP integrations go in the macOS Keychain, never in MeatDeck's files.
- **Nothing gets sent unless you click Send.** Scheduled runs get an allowlist of read-only tools plus the dashboard's own MCP (`server/claude/allowlists.ts`). **Send** on a message starts a separate run whose allowlist adds only the send tools, and that run sends exactly that text to that recipient. **Mark sent** is for messages you sent yourself.
- **It's careful with your tokens.** Anything plain code can do (GitHub status, diffs, scheduling, dedupe) runs without Claude. Claude gets pre-computed facts instead of fetching them, pulses use a small model, and scheduled runs skip while the Mac is idle or locked.

## Providers

Scheduled runs, sends and integration actions run on **Claude Code**: they need its skills and claude.ai connectors.

Chat can run on any provider that's installed and logged in: **Claude Code**, **Codex** or **Cursor**. Each one gets MeatDeck's MCP, so it can read and update the dashboard.

## Credits

MeatDeck borrows its look, and its chat timeline and provider icons, from [T3 Code](https://github.com/pingdotgg/t3code) (MIT, © T3 Tools Inc.). See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for details and other bundled data.

## License

[MIT](LICENSE)
