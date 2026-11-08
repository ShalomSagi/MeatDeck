import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{server,shared,mcp,desktop,web/src}/**/*.test.{ts,tsx}"],
    environment: "node",
    // Server modules open the data folder on import. Tests must never touch the real ~/.meatdeck.
    env: { MEATDECK_HOME: mkdtempSync(join(tmpdir(), "meatdeck-test-")) },
  },
});
