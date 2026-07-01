#!/usr/bin/env node
import { Command } from "commander";
import * as clack from "@clack/prompts";
import open from "open";
import { createRequire } from "node:module";
import { buildConfig, formatValidationError } from "./config.js";
import { runAudit } from "./audit/index.js";
import { printTerminalReport } from "./report/terminal.js";
import { generateHtmlReport } from "./report/html.js";
import { createEditorLink } from "./project/resolve-source-file.js";
import type { AuditConfig, AuditResult, Category, Severity } from "./types.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const ALL_CHECKS = [
  { key: "links" as const, label: "Links", description: "Validate all internal and external links" },
  { key: "images" as const, label: "Images", description: "Detect broken images, missing alt text, oversized images" },
  { key: "accessibility" as const, label: "Accessibility", description: "Run axe-core WCAG accessibility checks" },
  { key: "securityHeaders" as const, label: "Security Headers", description: "Check for missing security headers" },
  { key: "consoleErrors" as const, label: "Console Errors", description: "Report browser console error messages" },
  { key: "hydrationErrors" as const, label: "Hydration Errors", description: "Detect React/Next.js hydration mismatches" },
  { key: "metadata" as const, label: "Metadata", description: "Check for missing SEO metadata" },
  { key: "mixedContent" as const, label: "Mixed Content", description: "Detect HTTP resources on HTTPS pages" },
  { key: "designIssues" as const, label: "Design Issues", description: "Typography, headings, contrast, touch targets, layout" },
];

const SEVERITY_LEVELS: Severity[] = ["critical", "high", "medium", "low", "info"];

const CATEGORY_ALIASES: Record<string, Category> = {
  "links": "links",
  "images": "images",
  "accessibility": "accessibility",
  "a11y": "accessibility",
  "security": "security",
  "security-headers": "security",
  "console": "console",
  "console-errors": "console",
  "hydration": "hydration",
  "hydration-errors": "hydration",
  "metadata": "metadata",
  "seo": "metadata",
  "mixed-content": "mixed-content",
  "mixedcontent": "mixed-content",
  "design": "design",
  "design-issues": "design",
};

function normalizeCategoryNames(input: string): Category[] {
  return parseCommaList(input).map((name) => {
    const lower = name.toLowerCase();
    return CATEGORY_ALIASES[lower] ?? (lower as Category);
  });
}

function parseCommaList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

const CHECK_ALIASES: Record<string, string> = {
  "links": "links",
  "images": "images",
  "accessibility": "accessibility",
  "a11y": "accessibility",
  "security-headers": "securityHeaders",
  "securityheaders": "securityHeaders",
  "console-errors": "consoleErrors",
  "consoleerrors": "consoleErrors",
  "hydration-errors": "hydrationErrors",
  "hydrationerrors": "hydrationErrors",
  "metadata": "metadata",
  "seo": "metadata",
  "mixed-content": "mixedContent",
  "mixedcontent": "mixedContent",
  "design-issues": "designIssues",
  "designissues": "designIssues",
  "design": "designIssues",
};

const VALID_CHECK_KEYS = new Set([
  "links", "images", "accessibility", "securityHeaders",
  "consoleErrors", "hydrationErrors", "metadata", "mixedContent", "designIssues",
]);

function normalizeCheckNames(input: string): string[] {
  return parseCommaList(input).map((name) => {
    const lower = name.toLowerCase();
    return CHECK_ALIASES[lower] ?? lower;
  });
}

function resolveChecks(only?: string, skip?: string): AuditConfig["checks"] | undefined {
  if (!only && !skip) return undefined;

  const checks: AuditConfig["checks"] = {
    links: true,
    images: true,
    accessibility: true,
    securityHeaders: true,
    consoleErrors: true,
    hydrationErrors: true,
    metadata: true,
    mixedContent: true,
    designIssues: true,
  };

  if (only) {
    const onlyKeys = new Set(normalizeCheckNames(only));
    const unknown = [...onlyKeys].filter((k) => !VALID_CHECK_KEYS.has(k));
    if (unknown.length > 0) {
      console.error(`Unknown check(s): ${unknown.join(", ")}. Run "site-doctor list-checks" for available options.`);
      process.exit(1);
    }
    for (const key of Object.keys(checks) as (keyof typeof checks)[]) {
      if (!onlyKeys.has(key)) checks[key] = false;
    }
  }

  if (skip) {
    const skipKeys = new Set(normalizeCheckNames(skip));
    const unknown = [...skipKeys].filter((k) => !VALID_CHECK_KEYS.has(k));
    if (unknown.length > 0) {
      console.error(`Unknown check(s): ${unknown.join(", ")}. Run "site-doctor list-checks" for available options.`);
      process.exit(1);
    }
    for (const key of skipKeys) {
      if (key in checks) (checks as Record<string, boolean>)[key] = false;
    }
  }

  return checks;
}

function filterIssues(issues: AuditResult["issues"], severity?: string, category?: string): AuditResult["issues"] {
  let filtered = issues;
  if (severity) {
    const severities = new Set(parseCommaList(severity).map((s) => s.toLowerCase() as Severity));
    filtered = filtered.filter((i) => severities.has(i.severity));
  }
  if (category) {
    const categories = new Set(normalizeCategoryNames(category));
    filtered = filtered.filter((i) => categories.has(i.category));
  }
  return filtered;
}

const program = new Command();

program
  .name("site-doctor")
  .description("Audit rendered websites for broken links, images, a11y, design issues, and more.")
  .version(pkg.version);

program
  .command("audit")
  .description("Audit a website by crawling its pages.")
  .option("--url <url>", "Base URL to audit (e.g. http://localhost:3000)")
  .option("--max-pages <number>", "Maximum pages to crawl", "25")
  .option("--report <format>", "Output format: terminal, json, html", "terminal")
  .option("--output <path>", "File path for HTML or JSON report")
  .option("--open", "Open HTML report in the default browser", true)
  .option("--no-open", "Do not open HTML report in the browser")
  .option("--project-dir <path>", "Path to the project source directory (enables source-file links)")
  .option("--editor <name>", "Editor for source-file links: vscode, cursor, webstorm", "vscode")
  .option("--open-files", "Open source files with critical/high issues in the editor", false)
  .option("--only <checks>", "Run only these checks (comma-separated, e.g. links,design-issues)")
  .option("--skip <checks>", "Skip these checks (comma-separated, e.g. accessibility,console-errors)")
  .option("--severity <levels>", "Filter issues by severity (comma-separated: critical,high,medium,low,info)")
  .option("--category <cats>", "Filter issues by category (comma-separated: links,images,accessibility,security,console,hydration,metadata,mixed-content,design)")
  .action(async (options) => {
    try {
      const url = options.url;
      if (!url) {
        await interactiveAudit(options);
        return;
      }

      await runAuditWithOptions(options, url);
    } catch (error) {
      if (error instanceof Error && "issues" in error) {
        console.error("Invalid options:\n" + formatValidationError(error as never));
      } else {
        console.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

program
  .command("list-checks")
  .description("List all available audit checks with descriptions.")
  .action(() => {
    console.log("\n  Available audit checks:\n");
    console.log("  Flag name".padEnd(22) + "Config key".padEnd(20) + "Description");
    console.log("  " + "-".repeat(70));
    for (const check of ALL_CHECKS) {
      const flag = Object.entries(CHECK_ALIASES)
        .filter(([, v]) => v === check.key)
        .map(([k]) => k)
        .find((k) => k.includes("-")) ?? check.key;
      console.log(`  ${flag.padEnd(22)}${check.key.padEnd(20)}${check.description}`);
    }
    console.log("\n  Usage:");
    console.log("    site-doctor audit --url http://localhost:3000 --only design-issues,links");
    console.log("    site-doctor audit --url http://localhost:3000 --skip accessibility,console-errors");
    console.log("    site-doctor audit --url http://localhost:3000 --severity high,critical --category design,security");
    console.log("");
  });

program.parse();

async function interactiveAudit(options: Record<string, unknown>): Promise<void> {
  clack.intro(`site-doctor v${pkg.version}`);

  const url = await clack.text({
    message: "What URL do you want to audit?",
    placeholder: "http://localhost:3000",
    validate: (value) => {
      if (!value) return "URL is required";
      const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        new URL(withProtocol);
        return;
      } catch {
        return "Please enter a valid URL (e.g. subhbits.com or http://localhost:3000)";
      }
    },
  });

  if (clack.isCancel(url)) {
    clack.cancel("Audit cancelled.");
    process.exit(0);
  }

  const normalizedUrl: string = /^https?:\/\//i.test(url as string) ? (url as string) : `https://${url}`;

  const maxPages = await clack.text({
    message: "How many pages to crawl?",
    placeholder: "25",
    initialValue: "25",
    validate: (value) => {
      const num = Number(value);
      if (isNaN(num) || num < 1) return "Please enter a positive number";
      return;
    },
  });

  if (clack.isCancel(maxPages)) {
    clack.cancel("Audit cancelled.");
    process.exit(0);
  }

  const selectedChecks = await clack.multiselect({
    message: "Which checks would you like to run? (space to toggle, a to select all)",
    options: ALL_CHECKS.map((c) => ({
      value: c.key,
      label: c.label,
      hint: c.description,
    })),
    initialValues: ALL_CHECKS.map((c) => c.key),
    required: true,
  });

  if (clack.isCancel(selectedChecks)) {
    clack.cancel("Audit cancelled.");
    process.exit(0);
  }

  const selectedSeverities = await clack.multiselect({
    message: "Filter by severity? (enter to skip — shows all)",
    options: SEVERITY_LEVELS.map((s) => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    })),
    initialValues: [],
    required: false,
  });

  if (clack.isCancel(selectedSeverities)) {
    clack.cancel("Audit cancelled.");
    process.exit(0);
  }

  const reportFormat = await clack.select({
    message: "Output format?",
    options: [
      { value: "terminal", label: "Terminal" },
      { value: "json", label: "JSON" },
      { value: "html", label: "HTML" },
    ],
    initialValue: "terminal",
  });

  if (clack.isCancel(reportFormat)) {
    clack.cancel("Audit cancelled.");
    process.exit(0);
  }

  const checks: AuditConfig["checks"] = {
    links: (selectedChecks as string[]).includes("links"),
    images: (selectedChecks as string[]).includes("images"),
    accessibility: (selectedChecks as string[]).includes("accessibility"),
    securityHeaders: (selectedChecks as string[]).includes("securityHeaders"),
    consoleErrors: (selectedChecks as string[]).includes("consoleErrors"),
    hydrationErrors: (selectedChecks as string[]).includes("hydrationErrors"),
    metadata: (selectedChecks as string[]).includes("metadata"),
    mixedContent: (selectedChecks as string[]).includes("mixedContent"),
    designIssues: (selectedChecks as string[]).includes("designIssues"),
  };

  const checkNames = ALL_CHECKS
    .filter((c) => (selectedChecks as string[]).includes(c.key))
    .map((c) => c.label)
    .join(", ");

  clack.log.info(`Auditing ${normalizedUrl} (${checkNames}, max ${maxPages} pages)...`);

  const config = buildConfig({
    url: normalizedUrl,
    maxPages: Number(maxPages),
    report: reportFormat as "terminal" | "json" | "html",
    checks,
  });

  const spinner = clack.spinner();
  spinner.start("Running audit checks...");

  const result = await runAudit(config, options.projectDir as string | undefined);

  spinner.stop("Audit complete.");

  const filteredIssues = filterIssues(
    result.issues,
    (selectedSeverities as string[]).length > 0 ? (selectedSeverities as string[]).join(",") : undefined,
    undefined,
  );

  const filteredResult: AuditResult = { ...result, issues: filteredIssues };

  clack.note(
    `Pages: ${result.pagesCrawled} | Issues: ${filteredIssues.length}`,
    "Results",
  );

  if (reportFormat === "terminal") {
    printTerminalReport({ ...filteredResult, issues: filteredIssues });
  } else if (reportFormat === "json") {
    const json = JSON.stringify({ ...filteredResult, issues: filteredIssues }, null, 2);
    if (options.output) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(options.output as string, json, "utf-8");
      clack.log.info(`JSON report written to ${options.output}`);
    } else {
      console.log(json);
    }
  } else if (reportFormat === "html") {
    const shouldOpen = options.open !== false;
    const filePath = await generateHtmlReport({ ...filteredResult, issues: filteredIssues }, {
      open: shouldOpen,
      output: options.output as string | undefined,
      editor: (options.editor as string) || "vscode",
    });
    clack.log.info(`HTML report written to ${filePath}`);
    if (shouldOpen) {
      clack.log.info("Opening report in your default browser...");
    }
  }

  clack.outro("Done!");
}

async function runAuditWithOptions(options: Record<string, unknown>, url: string): Promise<void> {
  if (options.only && options.skip) {
    console.error("Error: --only and --skip are mutually exclusive.");
    process.exit(1);
  }

  const checksOverride = resolveChecks(options.only as string | undefined, options.skip as string | undefined);

  const config = buildConfig({
    url,
    maxPages: Number(options.maxPages),
    report: options.report as "terminal" | "json" | "html",
    checks: checksOverride,
  });

  console.error(`site-doctor: auditing ${url}\n`);
  const result = await runAudit(config, options.projectDir as string | undefined);

  const filteredIssues = filterIssues(
    result.issues,
    options.severity as string | undefined,
    options.category as string | undefined,
  );

  const filteredResult: AuditResult = { ...result, issues: filteredIssues };

  if (config.report === "terminal") {
    printTerminalReport(filteredResult);
  } else if (config.report === "json") {
    const json = JSON.stringify(filteredResult, null, 2);
    if (options.output) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(options.output as string, json, "utf-8");
      console.log(`JSON report written to ${options.output}`);
    } else {
      console.log(json);
    }
  } else if (config.report === "html") {
    const shouldOpen = options.open && !options.noOpen;
    const filePath = await generateHtmlReport(filteredResult, {
      open: shouldOpen as boolean,
      output: options.output as string | undefined,
      editor: (options.editor as string) || "vscode",
    });
    console.log(`HTML report written to ${filePath}`);
    if (shouldOpen) {
      console.log("Opening report in your default browser...");
    }

    if (options.openFiles) {
      await openSourceFiles(filteredResult, (options.editor as string) || "vscode");
    }
  }
}

async function openSourceFiles(result: AuditResult, editor: string): Promise<void> {
  const severeIssues = result.issues.filter(
    (issue) => issue.severity === "critical" || issue.severity === "high",
  );

  const pageUrls = new Set(severeIssues.map((issue) => issue.page));
  const filesToOpen = new Set<string>();

  for (const page of result.pages) {
    if (pageUrls.has(page.url) && page.sourceFile) {
      filesToOpen.add(page.sourceFile);
    }
  }

  if (filesToOpen.size === 0) {
    console.log("No source files with critical/high issues to open.");
    return;
  }

  console.log(`Opening ${filesToOpen.size} source file(s) in ${editor}:`);
  for (const file of filesToOpen) {
    console.log(`  - ${file}`);
    const editorUrl = createEditorLink(file, editor);
    try {
      await open(editorUrl);
    } catch (error) {
      console.error(`Could not open ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}