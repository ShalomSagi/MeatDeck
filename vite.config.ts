import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

// The emoji picker (frimousse) loads Emojibase data by URL. Ship it with the app instead of the CDN,
// so the doc icon picker works offline: emitted into dist at build, served from node_modules in dev.
const EMOJI_FILES = ["data.json", "messages.json"];
const emojibase = (): Plugin => ({
  name: "meatdeck-emojibase",
  configureServer(server) {
    server.middlewares.use("/emojibase/en", (req, res, next) => {
      const file = EMOJI_FILES.find((f) => req.url === `/${f}`);
      if (!file) return next();
      res.setHeader("content-type", "application/json");
      res.end(readFileSync(new URL(`./node_modules/emojibase-data/en/${file}`, import.meta.url)));
    });
  },
  generateBundle() {
    for (const f of EMOJI_FILES)
      this.emitFile({
        type: "asset",
        fileName: `emojibase/en/${f}`,
        source: readFileSync(new URL(`./node_modules/emojibase-data/en/${f}`, import.meta.url)),
      });
  },
});

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss(), emojibase()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:4317" },
  },
});
