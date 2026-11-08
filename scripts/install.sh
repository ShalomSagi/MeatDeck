#!/bin/zsh
# Builds "MeatDeck (Alpha).app" and installs it to /Applications. On first launch the app:
#   - starts its own backend (127.0.0.1:4317) and enables "open at login",
#   - registers the `meatdeck` MCP server with Claude Code (user scope),
#   - installs the /today skill (this script links it to the repo instead, so edits apply live).
set -euo pipefail
ROOT="${0:A:h:h}"
cd "$ROOT"

pnpm install --silent
pnpm package >/dev/null
APP="MeatDeck (Alpha).app"
echo "✓ built $APP"

mkdir -p "$HOME/.claude/skills"
ln -sfn "$ROOT/skill/today" "$HOME/.claude/skills/today"
echo "✓ linked /today skill to the repo"

osascript -e 'quit app "MeatDeck (Alpha)"' >/dev/null 2>&1 || true
# Wait until the old app and its backend have really exited (up to 20s, then force it). Relaunching
# while it's still shutting down hits Electron's single-instance lock and the new app exits at once;
# a lingering backend would be reused by the new app and keep serving the old build.
# (The MCP helpers run the same binary with mcp.mjs and belong to Claude sessions: leave them.)
MAIN="MacOS/MeatDeck \(Alpha\)$"
BACKEND="MacOS/MeatDeck \\(Alpha\\) .*/dist-electron/server\\.mjs$"  # only the app's own backend process
for _ in {1..40}; do
  pgrep -f "$MAIN" >/dev/null || pgrep -f "$BACKEND" >/dev/null || break
  sleep 0.5
done
pkill -f "$MAIN" 2>/dev/null || true
pkill -f "$BACKEND" 2>/dev/null || true
sleep 0.5
rm -rf "/Applications/$APP"
cp -R "release/mac-arm64/$APP" /Applications/
# `open` passes this shell's env to the app: never let ELECTRON_RUN_AS_NODE through (it would start as plain Node and exit).
env -u ELECTRON_RUN_AS_NODE -u PORT -u MEATDECK_DIST open "/Applications/$APP"
echo "✓ installed /Applications/$APP and launched it"
