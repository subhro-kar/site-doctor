# site-doctor

[![npm version](https://img.shields.io/npm/v/site-doctor.svg)](https://www.npmjs.com/package/site-doctor) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org/)

Audit rendered websites for broken links, images, accessibility violations, security header gaps, design issues, SEO metadata problems, console errors, hydration errors, and mixed content. Works with any URL — localhost, staging, or production.

**MCP server included** — use site-doctor directly from Claude, Cursor, Windsurf, or any MCP-compatible AI tool.

![Interactive mode](https://raw.githubusercontent.com/subhro-kar/site-doctor/main/assets/interactive-mode.png)
![Terminal report](https://raw.githubusercontent.com/subhro-kar/site-doctor/main/assets/terminal-report.png)
![HTML report](https://raw.githubusercontent.com/subhro-kar/site-doctor/main/assets/html-output.png)

## Install

```bash
npm install -g site-doctor
```

Or run without installing:

```bash
npx site-doctor audit --url http://localhost:3000
```

## CLI Usage

### Interactive mode

Run without `--url` to launch an interactive prompt:

```bash
site-doctor audit
```

You'll be guided through selecting a URL, checks, severity filters, and output format.

### One-shot mode

```bash
site-doctor audit --url http://localhost:3000
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | Base URL to audit. Omit to launch interactive mode. | — |
| `--max-pages <number>` | Maximum pages to crawl. | `25` |
| `--report <terminal\|json\|html>` | Output format. | `terminal` |
| `--output <path>` | Write JSON or HTML report to a file. | — |
| `--open` | Open HTML report in the browser. | `true` for HTML |
| `--no-open` | Do not open HTML report in the browser. | — |
| `--open-files` | Open source files with critical/high issues in your editor. | `false` |
| `--project-dir <path>` | Path to project source for source-file links. | — |
| `--editor <vscode\|cursor\|webstorm>` | Editor for source-file links. | `vscode` |
| `--only <checks>` | Run only these checks (comma-separated). Mutually exclusive with `--skip`. | — |
| `--skip <checks>` | Skip these checks (comma-separated). Mutually exclusive with `--only`. | — |
| `--severity <levels>` | Filter issues by severity (comma-separated: `critical,high,medium,low,info`). | — |
| `--category <cats>` | Filter issues by category (comma-separated: `links,images,accessibility,security,console,hydration,metadata,mixed-content,design`). | — |

### Check name aliases

`--only` and `--skip` accept both kebab-case and common aliases:

| Check | Aliases |
|-------|---------|
| `links` | `links` |
| `images` | `images` |
| `accessibility` | `accessibility`, `a11y` |
| `securityHeaders` | `security-headers`, `securityheaders` |
| `consoleErrors` | `console-errors`, `consoleerrors` |
| `hydrationErrors` | `hydration-errors`, `hydrationerrors` |
| `metadata` | `metadata`, `seo` |
| `mixedContent` | `mixed-content`, `mixedcontent` |
| `designIssues` | `design-issues`, `designissues`, `design` |

### Examples

Interactive audit (prompts for URL, checks, severity, format):

```bash
site-doctor audit
```

Terminal report:

```bash
site-doctor audit --url http://localhost:3000 --max-pages 10
```

Run only design and accessibility checks:

```bash
site-doctor audit --url http://localhost:3000 --only design,a11y
```

Skip console and hydration checks, show only critical/high issues:

```bash
site-doctor audit --url http://localhost:3000 --skip console-errors,hydration-errors --severity critical,high
```

Filter by category and output as JSON:

```bash
site-doctor audit --url http://localhost:3000 --category design,security --report json --output report.json
```

HTML report (auto-opens browser):

```bash
site-doctor audit --url http://localhost:3000 --report html --project-dir ./apps/web
```

Open source files in VSCode for critical/high issues:

```bash
site-doctor audit --url http://localhost:3000 --report html --project-dir ./apps/web --open-files
```

### List available checks

```bash
site-doctor list-checks
```

## MCP Server

site-doctor ships a built-in [Model Context Protocol](https://modelcontextprotocol.io) server so AI agents can run audits without the CLI.

### Tools

| Tool | Description |
|------|-------------|
| `audit` | Run a full audit. Parameters: `url` (required), `maxPages` (default 25), `checks` (toggle individual checks). Returns a markdown summary grouped by severity. |
| `list-checks` | List all available audit checks with descriptions. Use this before running a full audit. |

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "site-doctor": {
      "command": "npx",
      "args": ["-y", "site-doctor-mcp"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "site-doctor": {
      "command": "npx",
      "args": ["-y", "site-doctor-mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "site-doctor": {
      "command": "npx",
      "args": ["-y", "site-doctor-mcp"]
    }
  }
}
```

### opencode

Add to `opencode.json`:

```json
{
  "mcp": {
    "site-doctor": {
      "type": "local",
      "command": ["npx", "-y", "site-doctor-mcp"],
      "enabled": true
    }
  }
}
```

### Global install

If installed globally, you can use the binary directly instead of `npx`:

```json
{
  "mcpServers": {
    "site-doctor": {
      "command": "site-doctor-mcp"
    }
  }
}
```

## Checks

| Check | Flag name | What it finds |
|-------|-----------|---------------|
| **Crawl** | — | Discovers same-origin pages, respects `maxPages`, skips downloads |
| **Links** | `links` | Broken internal/external links, redirect loops, blocked URLs |
| **Images** | `images` | Broken images, missing `alt`, missing dimensions, oversized files, lazy-loaded hero images |
| **Accessibility** | `accessibility` (`a11y`) | axe-core WCAG violations — contrast, labels, landmarks, ARIA, heading order |
| **Security headers** | `security-headers` | Missing CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame protection |
| **Console errors** | `console-errors` | Grouped browser console errors with page context |
| **Hydration errors** | `hydration-errors` | React / Next.js hydration mismatches |
| **Metadata** | `metadata` (`seo`) | Missing title, description, canonical, Open Graph image, H1 issues |
| **Mixed content** | `mixed-content` | HTTP resources loaded on HTTPS pages |
| **Design issues** | `design-issues` (`design`) | Heading hierarchy, typography scale & readability, color contrast, touch targets, responsive layout, text walls |

## Source-file links

When you pass `--project-dir`, the HTML report links each page to its source file. Supports Next.js `app/` and `pages/` routers, including monorepos. Click the file link to open it in VS Code, Cursor, or WebStorm.

## Programmatic API

You can also use site-doctor as a library:

```ts
import { runAudit, buildConfig } from "site-doctor";

const config = buildConfig({ url: "http://localhost:3000", maxPages: 10 });
const result = await runAudit(config);

console.log(`Found ${result.issues.length} issues`);
for (const issue of result.issues) {
  console.log(`[${issue.severity}] ${issue.category}: ${issue.message}`);
}
```

## License

MIT