import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "playwright";
import type { AuditConfig, Issue, PageData } from "../types.js";

export async function checkAccessibility(
  pages: PageData[],
  config: AuditConfig,
  getPage: () => Promise<Page>,
  closePage: (page: Page) => Promise<void>,
): Promise<Issue[]> {
  if (!config.checks.accessibility) return [];

  const issues: Issue[] = [];

  for (const pageData of pages) {
    const page = await getPage();
    try {
      await page.goto(pageData.url, { waitUntil: "networkidle", timeout: 30000 });
      const results = await new AxeBuilder({ page }).analyze();

      for (const violation of results.violations) {
        for (const node of violation.nodes) {
          issues.push({
            id: violation.id,
            severity: mapImpact(violation.impact),
            category: "accessibility",
            page: pageData.url,
            message: `${violation.help} (${violation.id})`,
            selector: node.target.join(", "),
            suggestion: violation.helpUrl,
          });
        }
      }
    } catch (error) {
      issues.push({
        id: "axe-analysis-failed",
        severity: "medium",
        category: "accessibility",
        page: pageData.url,
        message: `Accessibility check failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Ensure the page is fully loaded and not protected.",
      });
    } finally {
      await closePage(page);
    }
  }

  return issues;
}

function mapImpact(impact: string | null | undefined): Issue["severity"] {
  switch (impact) {
    case "critical":
      return "critical";
    case "serious":
      return "high";
    case "moderate":
      return "medium";
    case "minor":
      return "low";
    default:
      return "medium";
  }
}
