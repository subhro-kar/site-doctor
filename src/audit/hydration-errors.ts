import type { AuditConfig, Issue, PageData } from "../types.js";

const HYDRATION_PATTERNS = [
  /hydrat/i,
  /text content does not match/i,
  /did not match/i,
  /server did not respond with a valid hydration/i,
  /minified react error #418/i,
  /minified react error #423/i,
  /minified react error #425/i,
];

export function checkHydrationErrors(
  pages: PageData[],
  config: AuditConfig,
): Issue[] {
  if (!config.checks.hydrationErrors) return [];

  const issues: Issue[] = [];

  for (const page of pages) {
    const messages = [...page.consoleMessages, ...page.pageErrors.map((e) => ({ text: e.message }))];
    const grouped = new Map<string, number>();

    for (const msg of messages) {
      if (HYDRATION_PATTERNS.some((pattern) => pattern.test(msg.text))) {
        grouped.set(msg.text, (grouped.get(msg.text) ?? 0) + 1);
      }
    }

    for (const [text, count] of grouped) {
      issues.push({
        id: "hydration-error",
        severity: "high",
        category: "hydration",
        page: page.url,
        message: count > 1 ? `Hydration error (${count}×): ${text}` : `Hydration error: ${text}`,
        suggestion:
          "Ensure server-rendered HTML matches client-rendered output. Avoid using browser-only APIs during SSR.",
      });
    }
  }

  return issues;
}
