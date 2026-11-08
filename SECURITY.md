# Security

MeatDeck runs locally, holds no service tokens of its own, and starts Claude Code runs with narrow tool allowlists. Bugs that break those promises are security bugs. Examples: a way for a scheduled run to send a message, a tool escaping its allowlist, a secret written outside the macOS Keychain, or the local backend being reachable from another machine or from a web page.

Please report them privately through [GitHub's private vulnerability reporting](https://github.com/ShalomSagi/MeatDeck/security/advisories/new), not in a public issue. Include the steps to reproduce and the version you tested. You'll get an answer within a week.
