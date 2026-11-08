#!/bin/zsh
# Removes "MeatDeck (Alpha).app", its login item, the MCP registration and the skill link. Keeps ~/.meatdeck.
osascript -e 'tell application "System Events" to delete login item "MeatDeck (Alpha)"' >/dev/null 2>&1
osascript -e 'quit app "MeatDeck (Alpha)"' >/dev/null 2>&1
sleep 2
rm -rf "/Applications/MeatDeck (Alpha).app" /Applications/Meatdeck.app
claude mcp remove --scope user meatdeck >/dev/null 2>&1
rm -f "$HOME/.claude/skills/today"
echo "Removed. Data left in ~/.meatdeck."
