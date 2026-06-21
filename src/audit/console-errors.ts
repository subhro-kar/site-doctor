import type { AuditConfig, Issue, PageData } from "../types.js";

export function checkConsoleErrors(
  pages: PageData[],
  config: AuditConfig,
): Issue[] {
  if (!config.checks.consoleErrors) return [];

  const issues: Issue[] = [];

  for (const page of pages) {
    const errors = page.consoleMessages.filter((msg) => msg.type === "error");
    const grouped = groupMessages(errors);

    for (const [text, count] of grouped) {
      issues.push({
        id: "console-error",
        severity: "medium",
        category: "console",
        page: page.url,
        message: count > 1 ? `Console error (${count}×): ${text}` : `Console error: ${text}`,
        suggestion: "Inspect the browser console and fix the underlying error.",
      });
    }
  }

  return issues;
}

function groupMessages(messages: { text: string }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const msg of messages) {
    map.set(msg.text, (map.get(msg.text) ?? 0) + 1);
  }
  return map;
}
