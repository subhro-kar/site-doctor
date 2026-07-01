import type { AuditResult, Issue, Severity, Category } from "../types.js";

const severityColor: Record<Issue["severity"], string> = {
  info: "\x1b[34m", // blue
  low: "\x1b[32m", // green
  medium: "\x1b[33m", // yellow
  high: "\x1b[35m", // magenta
  critical: "\x1b[31m", // red
};

const reset = "\x1b[0m";

export type ReportFilterOptions = {
  severity?: Severity[];
  category?: Category[];
};

export function printTerminalReport(
  result: AuditResult,
  options?: ReportFilterOptions,
): void {
  let issues = result.issues;

  if (options?.severity?.length) {
    const severitySet = new Set(options.severity);
    issues = issues.filter((i) => severitySet.has(i.severity));
  }

  if (options?.category?.length) {
    const categorySet = new Set(options.category);
    issues = issues.filter((i) => categorySet.has(i.category));
  }

  console.log("");
  console.log("═".repeat(60));
  console.log("  site-doctor audit report");
  console.log("═".repeat(60));
  console.log(`  URL:        ${result.config.url}`);
  console.log(`  Max pages:  ${result.config.maxPages}`);
  console.log(`  Report:     ${result.config.report}`);
  console.log("─".repeat(60));
  console.log(`  Pages crawled: ${result.pagesCrawled}`);
  console.log(`  Total issues:  ${issues.length}${issues.length !== result.issues.length ? ` (filtered from ${result.issues.length})` : ""}`);
  console.log("═".repeat(60));

  if (issues.length === 0) {
    console.log("\n  No issues found.\n");
    return;
  }

  const grouped = groupBy(issues, (issue) => issue.page);

  for (const [page, pageIssues] of grouped) {
    console.log(`\n  📄 ${page}`);
    for (const issue of pageIssues) {
      const color = severityColor[issue.severity];
      console.log(
        `     ${color}[${issue.severity.toUpperCase()}]${reset} [${issue.category}] ${issue.message}`,
      );
      if (issue.target) console.log(`        target:   ${issue.target}`);
      if (issue.selector) console.log(`        selector: ${issue.selector}`);
      if (issue.suggestion) console.log(`        tip:      ${issue.suggestion}`);
    }
  }
  console.log("");
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}