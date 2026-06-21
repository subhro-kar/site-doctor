import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { crawl } from "./crawl.js";
import { checkLinks } from "./links.js";
import { checkImages } from "./images.js";
import { checkAccessibility } from "./accessibility.js";
import { checkSecurityHeaders } from "./security-headers.js";
import { checkConsoleErrors } from "./console-errors.js";
import { checkHydrationErrors } from "./hydration-errors.js";
import { checkMetadata } from "./metadata.js";
import { checkMixedContent } from "./mixed-content.js";
import type { AuditConfig, AuditResult, Issue, PageData } from "../types.js";

export type RunAuditOptions = {
  config: AuditConfig;
  projectDir?: string;
};

export async function runAudit(
  config: AuditConfig,
  projectDir?: string,
): Promise<AuditResult> {
  const pages = await crawl({ startUrl: config.url, maxPages: config.maxPages, projectDir });

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  const getPage = async (): Promise<Page> => {
    if (!context) {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext();
    }
    return await context.newPage();
  };

  const closePage = async (page: Page): Promise<void> => {
    await page.close();
  };

  try {
    const issueGroups = await Promise.all([
      checkLinks(pages, config),
      checkImages(pages, config),
      checkAccessibility(pages, config, getPage, closePage),
      checkSecurityHeaders(pages, config),
      checkConsoleErrors(pages, config),
      checkHydrationErrors(pages, config),
      checkMetadata(pages, config),
      checkMixedContent(pages, config),
    ]);

    const issues = deduplicateIssues(issueGroups.flat());

    return {
      config,
      pagesCrawled: pages.length,
      pages,
      issues,
    };
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const unique: Issue[] = [];

  for (const issue of issues) {
    const key = `${issue.id}|${issue.page}|${issue.target ?? ""}|${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(issue);
    }
  }

  return unique;
}
