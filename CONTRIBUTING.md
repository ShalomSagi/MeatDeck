# Contributing

MeatDeck is a small project with one maintainer, so review time is limited. Opening a PR doesn't oblige anyone to merge it. Focused bug fixes, reliability fixes and integrations for more services are the most likely to land. For a new feature or a change in behavior, open an issue first and agree on the scope before writing code.

## Setup

You need macOS, Node.js 24+ and [pnpm](https://pnpm.io). Claude Code and the GitHub CLI (`gh`) are needed to run the app end to end, not to work on the code.

```sh
pnpm install
pnpm dev     # backend on :4317 + Vite on :5173
pnpm check   # format, lint, typecheck, unused code, tests: what CI runs
```

`pnpm dev` uses your real `~/.meatdeck/` data unless you set `MEATDECK_HOME`. To work against a scratch copy:

```sh
MEATDECK_HOME=/tmp/meatdeck-dev pnpm dev
```

Read [`AGENTS.md`](AGENTS.md) before your first change. It explains the layout and the rules every change follows, above all **code first, Claude last**: anything plain code can do must not spend the user's tokens.

## Pull requests

- **One problem per PR.** Split unrelated fixes and cleanups into their own PRs.
- **Show that it works.** Say how you reproduced the problem, how you checked the fix, and what you saw. Logic bugs come with a test that fails without the fix. UI changes come with before/after screenshots.
- **Say where the tokens go.** If the change touches a Claude run, say which parts are plain code and which use Claude, and why.
- **Keep `pnpm check` green.** Don't disable lint rules to get there.

## Reporting bugs

Open an issue with what you did, what you expected, what happened, and your macOS and MeatDeck versions. The app's run log on the Automation page often shows the cause. Remove anything private from logs before you paste them.

For security issues, see [`SECURITY.md`](SECURITY.md) instead.
