// electron-builder config for releases (scripts/release.sh): the app config from package.json,
// plus Developer ID signing, hardened runtime, notarization, a zip (what the in-app updater
// downloads) and a dmg (what people download to install) for GitHub Releases.
// Local builds (scripts/install.sh) keep using package.json's config: unsigned, a plain .app.
const { build: base } = require("../package.json");

const unsigned = process.env.MEATDECK_UNSIGNED === "1";

module.exports = {
  ...base,
  artifactName: "MeatDeck-${version}-mac-${arch}.${ext}",
  mac: {
    ...base.mac,
    target: [
      { target: "zip", arch: ["arm64"] },
      { target: "dmg", arch: ["arm64"] },
    ],
    // "-" = ad-hoc signature for local dry runs (a valid signature, no developer identity; the
    // updater refuses apps whose signature doesn't verify). Otherwise electron-builder finds the
    // "Developer ID Application" identity in the keychain, or in CSC_LINK / CSC_KEY_PASSWORD (CI).
    identity: unsigned ? "-" : undefined,
    hardenedRuntime: !unsigned,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    // Credentials come from the environment: APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER
    // (App Store Connect API key, used in CI), or APPLE_KEYCHAIN_PROFILE (notarytool profile).
    notarize: !unsigned,
  },
  dmg: {
    // No version in the name, so .../releases/latest/download/MeatDeck-mac-arm64.dmg always works.
    artifactName: "MeatDeck-mac-${arch}.${ext}",
    sign: !unsigned,
  },
};
