#!/bin/zsh
# Builds a MeatDeck release for GitHub Releases: a signed, notarized dmg (what people download to
# install), a zip of the app plus latest.json (version, notes, the zip's name, SHA-256 and size).
# Installed copies read latest.json to update
# themselves (server/updates.ts). Normally run by .github/workflows/release.yml when a v* tag is
# pushed; see RELEASING.md for the one-time signing setup and for running it on your own Mac.
#
#   scripts/release.sh                 build, sign, notarize; print what would be published
#   scripts/release.sh --publish       ...and create the GitHub release (needs `gh` logged in, or GH_TOKEN)
#   scripts/release.sh --unsigned      skip signing and notarization (local dry run; never publish these)
#
# Release notes: RELEASE_NOTES.md if present (or NOTES_FILE=path), else a one-line default.
set -euo pipefail
ROOT="${0:A:h:h}"
cd "$ROOT"

PUBLISH=0
UNSIGNED=0
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=1 ;;
    --unsigned) UNSIGNED=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
if (( PUBLISH && UNSIGNED )); then
  echo "Refusing to publish an unsigned build: users would get macOS's malware warning." >&2
  exit 2
fi

VERSION=$(node -p "require('./package.json').version")
REPO=$(node -p "require('./package.json').meatdeck.updates.github")
TAG="v$VERSION"
ZIP="release/MeatDeck-$VERSION-mac-arm64.zip"
DMG="release/MeatDeck-mac-arm64.dmg"
echo "MeatDeck $VERSION → $REPO ($TAG)"

if (( PUBLISH )) && gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release $TAG already exists on $REPO. Bump \"version\" in package.json first." >&2
  exit 1
fi

if (( UNSIGNED )); then
  export MEATDECK_UNSIGNED=1
  echo "! unsigned build (dry run)"
else
  # Signing identity: CSC_LINK/CSC_KEY_PASSWORD (CI) or a "Developer ID Application" cert in the keychain.
  if [[ -z "${CSC_LINK:-}" ]] && ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    echo "No \"Developer ID Application\" certificate found (keychain or CSC_LINK). See RELEASING.md." >&2
    exit 1
  fi
  if [[ -z "${APPLE_API_KEY:-}" && -z "${APPLE_KEYCHAIN_PROFILE:-}" ]]; then
    echo "No notarization credentials (APPLE_API_KEY… or APPLE_KEYCHAIN_PROFILE). See RELEASING.md." >&2
    exit 1
  fi
fi

rm -rf release dist dist-electron
MEATDECK_CHANNEL=release pnpm build
pnpm exec electron-builder --config scripts/electron-builder.release.cjs --mac --arm64 --publish never

for f in "$ZIP" "$DMG"; do [[ -f "$f" ]] || { echo "Expected $f" >&2; exit 1; }; done
if (( ! UNSIGNED )); then
  # The app inside the zip must be notarized (ticket stapled) and accepted by Gatekeeper.
  CHECK=$(mktemp -d)
  ditto -x -k "$ZIP" "$CHECK"
  spctl --assess --type execute --verbose=2 "$CHECK/"*.app
  xcrun stapler validate "$CHECK/"*.app
  rm -rf "$CHECK"

  # electron-builder notarizes the app, not the dmg around it. Notarize and staple the dmg too, so
  # it opens without a warning even offline.
  if [[ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]; then
    NOTARY=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
  else
    NOTARY=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
  fi
  xcrun notarytool submit "$DMG" "${NOTARY[@]}" --wait
  xcrun stapler staple "$DMG"
  spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG"
  xcrun stapler validate "$DMG"
fi

NOTES_FILE="${NOTES_FILE:-RELEASE_NOTES.md}"
if [[ -f "$NOTES_FILE" ]]; then NOTES=$(cat "$NOTES_FILE"); else NOTES="MeatDeck $VERSION"; fi
SHA=$(shasum -a 256 "$ZIP" | cut -d' ' -f1)
SIZE=$(stat -f%z "$ZIP")
NAME=$(basename "$ZIP")
NOTES="$NOTES" VERSION="$VERSION" NAME="$NAME" SHA="$SHA" SIZE="$SIZE" node -e '
  const e = process.env;
  const out = { version: e.VERSION, notes: e.NOTES, zip: { name: e.NAME, sha256: e.SHA, size: Number(e.SIZE) } };
  require("fs").writeFileSync("release/latest.json", JSON.stringify(out, null, 2) + "\n");
'
echo "✓ $DMG"
echo "✓ $ZIP ($SIZE bytes, sha256 $SHA)"
echo "✓ release/latest.json"

if (( PUBLISH )); then
  printf '%s\n' "$NOTES" > release/notes.md
  gh release create "$TAG" "$DMG" "$ZIP" release/latest.json --repo "$REPO" --title "MeatDeck $VERSION" --notes-file release/notes.md
  echo "✓ published $TAG on $REPO"
else
  echo "Dry run: not published. To publish: scripts/release.sh --publish (or push tag $TAG)."
fi
