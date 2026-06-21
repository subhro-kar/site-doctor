# site-doctor CLI roadmap

## Product direction

`site-doctor` is a reusable external CLI for auditing rendered Next.js apps and other websites. It should run against a local or deployed URL, crawl pages, collect issues, and produce reports that developers can act on quickly.

The tool should not be coupled to a specific app repository. Repo inspection can be added later as an optional mode, but the first version should work against any running site.

## Goals

- Find broken links, broken images, accessibility issues, weak security headers, console errors, and hydration errors.
- Produce clear terminal and HTML reports.
- Work locally with `localhost` and deployed URLs.
- Stay reusable across many projects.
- Keep checks modular so new audit categories can be added without rewriting the core.

## Non-goals for v1

- CI failure rules.
- Automatic code fixes.
- Full Lighthouse replacement.
- Chrome extension.
- Deep static analysis of the Next.js source tree.
- Product-specific rule files inside audited apps.

## Recommended package shape

```text
site-doctor-cli/
  package.json
  src/
    cli.ts
    config.ts
    audit/
      crawl.ts
      links.ts
      images.ts
      accessibility.ts
      security-headers.ts
      console-errors.ts
      hydration-errors.ts
      metadata.ts
      mixed-content.ts
    report/
      terminal.ts
      html.ts
      json.ts
    types.ts
```

## Suggested command design

```bash
site-doctor audit --url http://localhost:3000
site-doctor audit --url http://localhost:3000 --report html
site-doctor audit --url https://example.com --max-pages 100
```

## Core checks for v1

### 1. Crawl pages

- Start from a base URL.
- Follow same-origin links.
- Respect `maxPages`.
- Avoid duplicate URLs.
- Skip files like PDFs, ZIPs, downloads, and media assets unless directly checked as links.

### 2. Broken links

- Check internal links.
- Check external links with timeout and redirect handling.
- Report status code, source page, and target URL.
- Detect redirect loops.

### 3. Broken images

- Collect `img`, `picture source`, CSS background images if feasible, and Open Graph images.
- Check status code and content type.
- Report missing, blocked, or invalid image URLs.

### 4. Accessibility

- Run axe checks with Playwright.
- Report violation id, severity, page, selector, and short fix guidance.
- Include missing alt text, unlabeled controls, heading problems, color contrast, and landmark issues.

### 5. Security headers

- Check headers on the initial document response.
- Report missing or weak:
  - `content-security-policy`
  - `strict-transport-security`
  - `x-content-type-options`
  - `referrer-policy`
  - `permissions-policy`
  - `x-frame-options` or equivalent CSP `frame-ancestors`

### 6. Console errors

- Capture browser console errors.
- Capture uncaught page exceptions.
- Group repeated messages.
- Include page URL and stack trace when available.

### 7. Hydration errors

- Detect React and Next.js hydration mismatch messages.
- Keep these separate from generic console errors because they usually need different fixes.

### 8. Metadata checks

- Missing, empty, or duplicate `<title>`.
- Missing meta description.
- Missing canonical URL.
- Missing Open Graph image.
- Multiple H1s or missing H1.

### 9. Mixed content

- On HTTPS sites, report HTTP scripts, images, stylesheets, fonts, iframes, and fetch requests.

### 10. Basic image quality

- Missing `alt`.
- Missing width or height where layout shift is likely.
- Very large image transfer size.
- Hero image incorrectly lazy-loaded.

## v2 checks

- Robots and sitemap checks.
- External script risk report.
- Lightweight performance smoke checks.
- Form and input checks.
- Environment leak checks in rendered HTML and JS.
- Optional Next.js route discovery from `app/` and `pages/`.
- Optional dependency vulnerability scan through OSV or package manager audit.

## Report design

The report should group issues by severity and page.

Issue shape:

```ts
type Issue = {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category:
    | "links"
    | "images"
    | "accessibility"
    | "security"
    | "console"
    | "hydration"
    | "metadata"
    | "mixed-content"
    | "performance";
  page: string;
  message: string;
  target?: string;
  selector?: string;
  suggestion?: string;
};
```

Report outputs:

- Terminal summary for quick local use.
- JSON for machine-readable output.
- HTML report for browsing issues visually.

## Technical choices

- TypeScript.
- pnpm.
- Exact dependency versions.
- Zod for runtime config validation.
- Playwright for crawling and browser-level checks.
- `@axe-core/playwright` for accessibility.
- `undici` for HTTP requests.
- `commander` or `cac` for CLI parsing.

## Milestones

### Milestone 1: CLI skeleton

- Create package structure.
- Add `site-doctor audit --url`.
- Validate CLI options with Zod.
- Print a basic terminal report.

### Milestone 2: crawler

- Launch Playwright.
- Crawl same-origin pages.
- Capture document status codes.
- Store discovered links, images, console errors, and page exceptions.

### Milestone 3: link and image checks

- Add internal and external link validation.
- Add image validation.
- Add timeout and redirect handling.
- Deduplicate repeated failures.

### Milestone 4: accessibility and browser errors

- Add axe checks.
- Add console error grouping.
- Add hydration error classification.

### Milestone 5: security and metadata

- Add security header checks.
- Add mixed content checks.
- Add title, description, canonical, Open Graph, and H1 checks.

### Milestone 6: reports

- Add JSON report output.
- Add HTML report output.
- Add issue filtering by severity and category.

### Milestone 7: polish

- Add tests for individual checks.
- Add fixture websites for integration tests.
- Add documentation and examples.
- Prepare npm publishing.

## Example future config

```ts
import { defineConfig } from "site-doctor";

export default defineConfig({
  url: "http://localhost:3000",
  crawl: {
    maxPages: 100,
    exclude: ["/admin/**", "/api/**"],
  },
  checks: {
    links: true,
    images: true,
    accessibility: true,
    securityHeaders: true,
    consoleErrors: true,
    hydrationErrors: true,
    metadata: true,
    mixedContent: true,
  },
});
```

## First implementation target

Build the smallest useful version:

```text
site-doctor audit --url http://localhost:3000
```

It should crawl up to 25 pages and report:

- Broken links.
- Broken images.
- Accessibility violations.
- Security header issues.
- Console errors.
- Hydration errors.
- Metadata issues.

