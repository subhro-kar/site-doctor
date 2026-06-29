#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { auditToolSchema, handleAudit, handleListChecks } from "./tools.js";

const server = new McpServer({
  name: "site-doctor",
  version: "0.1.0",
});

server.tool(
  "audit",
  "Audit a website for broken links, images, accessibility issues, security headers, console errors, hydration errors, SEO metadata, and mixed content. Returns a summary of all issues found grouped by severity.",
  auditToolSchema,
  handleAudit,
);

server.tool(
  "list-checks",
  "List all available audit checks with descriptions. Use this to understand what the audit tool can check before running a full audit.",
  {},
  handleListChecks,
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});