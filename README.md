# site-doctor

A reusable CLI for auditing rendered websites. Crawls pages, checks links, images, accessibility, security headers, console errors, hydration errors, metadata, and mixed content — then reports everything in the terminal, JSON, or a browser-ready HTML report.

## Install

```bash
npm install -g site-doctor
```

Or run without installing:

```bash
npx site-doctor audit --url http://localhost:3000
```

## Usage

```bash
site-doctor audit --url http://localhost:3000
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | **Required.** Base URL to audit. | — |
| `--max-pages <number>` | Maximum pages to crawl. | `25` |
| `--report <terminal\|json\|html>` | Output format. | `terminal` |
| `--output <path>` | Write JSON or HTML report to a file. | — |
| `--open` | Open HTML report in the browser. | `true` for HTML |
| `--no-open` | Do not open HTML report in the browser. | — |
| `--open-files` | Open source files with critical/high issues in your editor. | `false` |
| `--project-dir <path>` | Path to project source for source-file links. | — |
| `--editor <vscode\|cursor\|webstorm>` | Editor for source-file links. | `vscode` |

### Examples

Terminal report:

```bash
site-doctor audit --url http://localhost:3000 --max-pages 10
```

HTML report (auto-opens browser):

```bash
site-doctor audit --url http://localhost:3000 --report html --project-dir ./apps/web
```

JSON report written to file:

```bash
site-doctor audit --url https://example.com --report json --output report.json
```

Open source files in VSCode for critical/high issues:

```bash
site-doctor audit --url http://localhost:3000 --report html --project-dir ./apps/web --open-files
```

## Checks

- **Crawl** — same-origin pages, respects `maxPages`, skips downloads.
- **Links** — internal and external link validation with redirect-loop detection.
- **Images** — broken images, missing `alt`, missing dimensions, oversized files, hero lazy-loading.
- **Accessibility** — axe-core violations.
- **Security headers** — CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame protection.
- **Console errors** — grouped browser console errors.
- **Hydration errors** — React / Next.js hydration mismatch detection.
- **Metadata** — title, description, canonical, Open Graph image, H1.
- **Mixed content** — HTTP resources on HTTPS pages.

## Source-file links

When you pass `--project-dir`, the HTML report links each page to its source file (supports Next.js `app/` and `pages/` routers, including monorepos). Click the 📄 file link to open the file in VSCode, Cursor, or WebStorm.

## License

MIT
