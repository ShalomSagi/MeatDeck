# Releasing MeatDeck

Releases are signed with a Developer ID certificate, notarized by Apple, and published on
[GitHub Releases](https://github.com/ShalomSagi/MeatDeck/releases). Installed copies check there a
few times a day; when there's a newer version, a small ↑ button appears in the sidebar footer, and
clicking it downloads the zip, checks it and restarts into it (`server/updates.ts`).

Notarization is Apple's automated malware scan. It's not App Store review: nobody approves the app,
and it takes a few minutes.

## One-time setup

Without the setup below, the Release workflow still publishes, but **unsigned**: ad-hoc signed, not
notarized, with notes that tell people how to open it (System Settings → Open Anyway). Once the
secrets exist, the next tag is signed and notarized automatically, and installed unsigned copies
update to it on their own. (The reverse is refused: a signed install never accepts an unsigned update.)

You need an Apple Developer Program membership. These steps run on a Mac signed in to that account.

### 1. Developer ID certificate

1. Xcode → Settings → Accounts → select the team → **Manage Certificates…** → **+** →
   **Developer ID Application**. (Or create it at developer.apple.com → Certificates.)
2. Keychain Access → My Certificates → right-click **Developer ID Application: …** → **Export…** →
   save as `MeatDeck.p12` with a strong password.
3. `base64 -i MeatDeck.p12 | pbcopy`, then delete the `.p12` file once it's stored as a secret.

### 2. Notarization key (App Store Connect API key)

1. [App Store Connect](https://appstoreconnect.apple.com/access/integrations/api) → Users and Access →
   Integrations → **Team Keys** → **+**, access **Developer**.
2. Download the `.p8` file (you can only download it once). Note the **Key ID** and the **Issuer ID**.

### 3. Repository secrets

GitHub → the repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret                | Value                               |
| --------------------- | ----------------------------------- |
| `MAC_CERT_P12_BASE64` | the base64 text from step 1         |
| `MAC_CERT_PASSWORD`   | the `.p12` export password          |
| `APPLE_API_KEY_P8`    | the full contents of the `.p8` file |
| `APPLE_API_KEY_ID`    | the Key ID                          |
| `APPLE_API_ISSUER`    | the Issuer ID                       |

Never commit any of these. `.gitignore` already excludes `*.p12`, `*.p8` and similar.

## Cutting a release

1. Bump `"version"` in `package.json` (for example `0.2.0-alpha`). Installed copies update when the
   release's version is higher than theirs.
2. Optionally write `RELEASE_NOTES.md`: it becomes the release notes and shows in the app.
3. Commit, then tag and push:

   ```sh
   git tag v0.2.0-alpha
   git push origin main v0.2.0-alpha
   ```

4. The **Release** workflow (`.github/workflows/release.yml`) checks the tag matches `package.json`,
   builds, signs, notarizes, checks the result with Gatekeeper, and publishes:
   - `MeatDeck-mac-arm64.dmg`: what people download to install. It has no version in its name, so
     `https://github.com/ShalomSagi/MeatDeck/releases/latest/download/MeatDeck-mac-arm64.dmg` always
     points at the newest one. The dmg is signed, notarized and stapled on its own, not just the app inside.
   - `MeatDeck-<version>-mac-arm64.zip` and `latest.json` (version, notes, the zip's SHA-256 and
     size): what installed copies download to update themselves.

Don't mark releases as pre-releases: the app reads GitHub's "latest release", which skips them.

## Releasing from your own Mac instead

With the certificate in your keychain and a notarytool profile:

```sh
xcrun notarytool store-credentials meatdeck --key AuthKey_XXXX.p8 --key-id <KEY_ID> --issuer <ISSUER_ID>
APPLE_KEYCHAIN_PROFILE=meatdeck ./scripts/release.sh            # build, sign, notarize, check
APPLE_KEYCHAIN_PROFILE=meatdeck ./scripts/release.sh --publish  # ...and publish (needs `gh auth login`)
```

`./scripts/release.sh --unsigned` makes a local dry run (ad-hoc signed, not notarized). It refuses
to publish such builds.

## How updates stay safe

- `latest.json` carries the zip's SHA-256; the app rejects a download that doesn't match.
- The new app's code signature must verify, and when the running app is Developer ID signed, the new
  one must be signed by the same Apple team.
- The swap keeps the old app until the new one is copied into place, and puts it back if the copy fails.
- Builds made from source (`./scripts/install.sh`) don't use GitHub at all: they update by
  rebuilding from their own source folder.
