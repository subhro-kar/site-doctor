import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const BROWSER_NOT_INSTALLED_PATTERN = /Executable doesn't exist at/i;

export function isBrowserNotInstalledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return BROWSER_NOT_INSTALLED_PATTERN.test(error.message);
}

export function installBrowsers(): void {
  const playwrightPkgJson = require.resolve("playwright/package.json");
  const cliPath = path.join(path.dirname(playwrightPkgJson), "cli.js");

  console.error("\nPlaywright browsers not found. Installing Chromium (one-time setup)...\n");

  try {
    execFileSync(process.execPath, [cliPath, "install", "chromium"], {
      encoding: "utf-8",
      timeout: 180_000,
      stdio: "inherit",
    });
    console.error("\nBrowser installed successfully.\n");
  } catch {
    console.error(
      "\nFailed to install Playwright browsers automatically.\n" +
        "Please run manually:\n\n" +
        "  npx playwright install chromium\n"
    );
    throw new Error(
      "Playwright browsers are not installed. Run `npx playwright install chromium` and try again."
    );
  }
}