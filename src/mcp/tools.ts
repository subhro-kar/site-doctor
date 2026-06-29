import { z } from "zod";
import { runAudit } from "../audit/index.js";
import { buildConfig } from "../config.js";
import type { AuditResult, Issue } from "../types.js";

export const auditToolSchema = {
  url: z.string().url().describe("Base URL to audit (e.g. https://example.com or http://localhost:3000)"),
  maxPages: z.coerce.number().int().positive().default(25).describe("Maximum number of pages to crawl"),
  checks: z.object({
    links: z.boolean().default(true).describe("Check for broken links"),
    images: z.boolean().default(true).describe("Check for broken images and image quality issues"),
    accessibility: z.boolean().default(true).describe("Run axe-core accessibility checks"),
    securityHeaders: z.boolean().default(true).describe("Check for missing security headers"),
    consoleErrors: z.boolean().default(true).describe("Check for browser console errors"),
    hydrationErrors: z.boolean().default(true).describe("Check for React/Next.js hydration errors"),
    metadata: z.boolean().default(true).describe("Check for missing SEO metadata"),
    mixedContent: z.boolean().default(true).describe("Check for mixed content (HTTP on HTTPS pages)"),
  }).default({}).describe("Which audit checks to run. All default to true."),
};

export type AuditToolInput = {
  url: string;
  maxPages?: number;
  checks?: {
    links?: boolean;
    images?: boolean;
    accessibility?: boolean;
    securityHeaders?: boolean;
    consoleErrors?: boolean;
    hydrationErrors?: boolean;
    metadata?: boolean;
    mixedContent?: boolean;
  };
};

function summarizeResult(result: AuditResult): string {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const issue of result.issues) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }

  const sorted = result.issues
    .slice()
    .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

  let output = `## Site Doctor Audit Results\n\n`;
  output += `**URL:** ${result.config.url}\n`;
  output += `**Pages crawled:** ${result.pagesCrawled}\n`;
  output += `**Total issues:** ${result.issues.length}\n\n`;

  output += `| Severity | Count |\n|----------|-------|\n`;
  for (const [severity, count] of Object.entries(counts)) {
    output += `| ${severity} | ${count} |\n`;
  }

  if (sorted.length > 0) {
    output += `\n### Issues\n\n`;
    for (const issue of sorted) {
      output += `- **[${issue.severity.toUpperCase()}]** [${issue.category}] ${issue.message}`;
      if (issue.target) output += ` — \`${issue.target}\``;
      if (issue.suggestion) output += ` → ${issue.suggestion}`;
      output += ` (${issue.page})\n`;
    }
  } else {
    output += `\nNo issues found! 🎉\n`;
  }

  return output;
}

export async function handleAudit(input: AuditToolInput) {
  try {
    const config = buildConfig({
      url: input.url,
      maxPages: input.maxPages,
      report: "json" as const,
      checks: input.checks ?? {},
    });

    const result = await runAudit(config);

    return {
      content: [
        {
          type: "text" as const,
          text: summarizeResult(result),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Audit failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

export async function handleListChecks() {
  const checks = [
    { name: "links", description: "Validates all internal and external links, detecting broken links and redirect loops" },
    { name: "images", description: "Detects broken images, missing alt text, oversized images, and lazy-loaded hero images" },
    { name: "accessibility", description: "Runs axe-core accessibility audits for WCAG compliance violations" },
    { name: "securityHeaders", description: "Checks for missing security headers (CSP, HSTS, X-Content-Type-Options, etc.)" },
    { name: "consoleErrors", description: "Reports browser console error messages found during crawl" },
    { name: "hydrationErrors", description: "Detects React/Next.js hydration mismatch errors" },
    { name: "metadata", description: "Checks for missing SEO metadata (title, description, canonical, OG image, H1)" },
    { name: "mixedContent", description: "Detects HTTP resources loaded on HTTPS pages" },
  ];

  let output = `## Available Audit Checks\n\n`;
  for (const check of checks) {
    output += `- **${check.name}**: ${check.description}\n`;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: output,
      },
    ],
  };
}