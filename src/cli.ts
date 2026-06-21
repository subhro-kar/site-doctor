#!/usr/bin/env node
import { Command } from "commander";
import open from "open";
import { buildConfig, formatValidationError } from "./config.js";
import { runAudit } from "./audit/index.js";
import { printTerminalReport } from "./report/terminal.js";
import { generateHtmlReport } from "./report/html.js";
import { createEditorLink } from "./project/resolve-source-file.js";
import type { AuditResult } from "./types.js";

const program = new Command();

program
  .name("site-doctor")
  .description("Audit rendered websites for broken links, images, a11y, and more.")
  .version("0.1.0");

program
  .command("audit")
  .description("Audit a website by crawling its pages.")
  .requiredOption("--url <url>", "Base URL to audit (e.g. http://localhost:3000)")
  .option("--max-pages <number>", "Maximum pages to crawl", "25")
  .option("--report <format>", "Output format: terminal, json, html", "terminal")
  .option("--output <path>", "File path for HTML or JSON report")
  .option("--open", "Open HTML report in the default browser", true)
  .option("--no-open", "Do not open HTML report in the browser")
  .option("--project-dir <path>", "Path to the project source directory (enables source-file links)")
  .option("--editor <name>", "Editor for source-file links: vscode, cursor, webstorm", "vscode")
  .option("--open-files", "Open source files with critical/high issues in the editor", false)
  .action(async (options) => {
    try {
      console.log(`site-doctor: auditing ${options.url}\n`);

      const config = buildConfig({
        url: options.url,
        maxPages: Number(options.maxPages),
        report: options.report,
      });

      const result = await runAudit(config, options.projectDir);

      if (config.report === "terminal") {
        printTerminalReport(result);
      } else if (config.report === "json") {
        const json = JSON.stringify(result, null, 2);
        if (options.output) {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(options.output, json, "utf-8");
          console.log(`JSON report written to ${options.output}`);
        } else {
          console.log(json);
        }
      } else if (config.report === "html") {
        const shouldOpen = options.open && !options.noOpen;
        const filePath = await generateHtmlReport(result, {
          open: shouldOpen,
          output: options.output,
          editor: options.editor,
        });
        console.log(`HTML report written to ${filePath}`);
        if (shouldOpen) {
          console.log("Opening report in your default browser...");
        }

        if (options.openFiles) {
          await openSourceFiles(result, options.editor);
        }
      }
    } catch (error) {
      if (error instanceof Error && "issues" in error) {
        console.error("Invalid options:\n" + formatValidationError(error as never));
      } else {
        console.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

program.parse();

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
