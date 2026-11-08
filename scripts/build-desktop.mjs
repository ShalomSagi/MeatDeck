// Bundles the Electron main/preload, the backend server and the MCP server into
// dist-electron/ so the packaged app needs no node_modules at runtime.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { manifestHash, sourceManifest } from "../shared/fingerprint.ts";

const common = { bundle: true, platform: "node", target: "node22", logLevel: "warning", sourcemap: false };
// ESM bundles that pull in CommonJS deps need a real `require`.
const esmBanner = {
  js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
};

await Promise.all([
  build({
    ...common,
    entryPoints: ["desktop/main.ts"],
    outfile: "dist-electron/main.cjs",
    format: "cjs",
    external: ["electron"],
  }),
  build({
    ...common,
    entryPoints: ["desktop/preload.ts"],
    outfile: "dist-electron/preload.cjs",
    format: "cjs",
    external: ["electron"],
  }),
  build({
    ...common,
    entryPoints: ["server/index.ts"],
    outfile: "dist-electron/server.mjs",
    format: "esm",
    banner: esmBanner,
  }),
  build({
    ...common,
    entryPoints: ["mcp/index.ts"],
    outfile: "dist-electron/mcp.mjs",
    format: "esm",
    banner: esmBanner,
  }),
]);
// Where this build's updates come from (server/updates.ts). Release builds (scripts/release.sh)
// update from GitHub Releases; everything else updates by rebuilding from this source folder.
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const builtAt = new Date().toISOString();
if (process.env.MEATDECK_CHANNEL === "release") {
  // MEATDECK_RELEASES_API: only for testing the updater against a stand-in for api.github.com.
  const api = process.env.MEATDECK_RELEASES_API;
  writeFileSync(
    "dist-electron/build.json",
    JSON.stringify({
      channel: "release",
      version: pkg.version,
      builtAt,
      github: pkg.meatdeck.updates.github,
      ...(api ? { api } : {}),
    }),
  );
} else {
  const repo = process.cwd();
  const manifest = sourceManifest(repo);
  writeFileSync(
    "dist-electron/build.json",
    JSON.stringify({ channel: "source", version: pkg.version, builtAt, repo, hash: manifestHash(manifest), manifest }),
  );
}
console.log("✓ dist-electron");
