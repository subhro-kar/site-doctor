import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import open from "open";
import { createEditorLink } from "../project/resolve-source-file.js";
import type { AuditResult, Issue, PageData } from "../types.js";

export async function generateHtmlReport(
  result: AuditResult,
  options: { open: boolean; output?: string; editor?: string } = { open: false },
): Promise<string> {
  const filePath = options.output ?? join(tmpdir(), `site-doctor-report-${Date.now()}.html`);
  const html = buildHtml(result, options.editor);
  writeFileSync(filePath, html, "utf-8");

  if (options.open) {
    await open(filePath);
  }

  return filePath;
}

function buildHtml(result: AuditResult, editor: string = "vscode"): string {
  const severityOrder: Issue["severity"][] = ["critical", "high", "medium", "low", "info"];
  const issues = [...result.issues].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  const bySeverity = groupCount(issues, (i) => i.severity);
  const byCategory = groupCount(issues, (i) => i.category);

  const pageByUrl = new Map(result.pages.map((p) => [p.url, p]));

  const renderPageCell = (pageUrl: string) => {
    const page = pageByUrl.get(pageUrl);
    const pageLink = `<a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">${escapeHtml(pageUrl)}</a>`;
    if (!page?.sourceFile) return pageLink;
    const editorUrl = createEditorLink(page.sourceFile, editor);
    return `${pageLink}<br/><small><a href="${escapeHtml(editorUrl)}">📄 ${escapeHtml(page.sourceFile)}</a></small>`;
  };

  const issueRows = issues
    .map(
      (issue) => `
    <tr data-severity="${issue.severity}" data-category="${issue.category}" data-page="${escapeHtml(issue.page)}">
      <td><span class="badge severity-${issue.severity}">${issue.severity}</span></td>
      <td><span class="badge category">${issue.category}</span></td>
      <td>${renderPageCell(issue.page)}</td>
      <td class="message">${escapeHtml(issue.message)}</td>
      <td class="truncate" title="${issue.target ? escapeHtml(issue.target) : ""}">${issue.target ? escapeHtml(issue.target) : "—"}</td>
      <td>${issue.selector ? `<code>${escapeHtml(issue.selector)}</code>` : "—"}</td>
      <td class="message">${issue.suggestion ? escapeHtml(issue.suggestion) : "—"}</td>
    </tr>
  `,
    )
    .join("");

  const metaItems = [
    { label: "URL", value: escapeHtml(result.config.url) },
    { label: "Pages crawled", value: `${result.pagesCrawled} / ${result.config.maxPages}` },
    { label: "Total issues", value: String(issues.length) },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>site-doctor report — ${escapeHtml(result.config.url)}</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #111111;
      --text: #f5f5f5;
      --muted: #888888;
      --border: #222222;
      --accent: #f5f5f5;
      --critical: #ff4444;
      --high: #ff8c42;
      --medium: #f5c542;
      --low: #4ade80;
      --info: #60a5fa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      font-size: 14px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 48px 24px;
    }
    header { margin-bottom: 40px; }
    header h1 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    header .subtitle {
      color: var(--muted);
      font-size: 14px;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      margin-bottom: 40px;
    }
    .meta-item dt {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .meta-item dd {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--text);
    }
    .counts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }
    .count {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }
    .count .value {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .count .label {
      font-size: 12px;
      color: var(--muted);
      text-transform: capitalize;
    }
    .count.critical .value { color: var(--critical); }
    .count.high .value { color: var(--high); }
    .count.medium .value { color: var(--medium); }
    .count.low .value { color: var(--low); }
    .count.info .value { color: var(--info); }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: end;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label {
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
    }
    .field select, .field input {
      background: #0a0a0a;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 14px;
      min-width: 160px;
    }
    .field input { min-width: 220px; }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    th {
      background: #0a0a0a;
      color: var(--muted);
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      position: sticky;
      top: 0;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #161616; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid;
    }
    .severity-critical { color: #ff6b6b; background: rgba(255,68,68,0.08); border-color: rgba(255,68,68,0.2); }
    .severity-high { color: #ff9f68; background: rgba(255,140,66,0.08); border-color: rgba(255,140,66,0.2); }
    .severity-medium { color: #f5d76e; background: rgba(245,197,66,0.08); border-color: rgba(245,197,66,0.2); }
    .severity-low { color: #6ee7b7; background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.2); }
    .severity-info { color: #93c5fd; background: rgba(96,165,250,0.08); border-color: rgba(96,165,250,0.2); }
    .category {
      color: var(--muted);
      background: #0a0a0a;
      border-color: var(--border);
      text-transform: capitalize;
    }
    td a { color: var(--accent); text-decoration: none; }
    td a:hover { text-decoration: underline; }
    td small { display: block; margin-top: 4px; font-size: 12px; }
    td small a { color: var(--muted); }
    code {
      background: #0a0a0a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: var(--text);
    }
    .empty { padding: 64px 24px; text-align: center; color: var(--muted); font-size: 16px; }
    .truncate { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .message { max-width: 360px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>site-doctor</h1>
      <p class="subtitle">Audit report for ${escapeHtml(result.config.url)}</p>
    </header>

    <dl class="meta">
      ${metaItems.map((item) => `<div class="meta-item"><dt>${item.label}</dt><dd>${item.value}</dd></div>`).join("")}
    </dl>

    <section class="counts">
      ${severityOrder.map((s) => `<div class="count ${s}"><span class="value">${bySeverity.get(s) ?? 0}</span><span class="label">${s}</span></div>`).join("")}
    </section>

    <section class="filters">
      <div class="field">
        <label for="severity-filter">Severity</label>
        <select id="severity-filter">
          <option value="">All</option>
          ${severityOrder.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="category-filter">Category</label>
        <select id="category-filter">
          <option value="">All</option>
          ${Array.from(byCategory.keys())
            .sort()
            .map((c) => `<option value="${c}">${c}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="search-filter">Search</label>
        <input id="search-filter" type="text" placeholder="message, target, selector..." />
      </div>
    </section>

    <main>
      ${issues.length === 0
        ? `<div class="empty">No issues found</div>`
        : `<table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Category</th>
                <th>Page</th>
                <th>Message</th>
                <th>Target</th>
                <th>Selector</th>
                <th>Suggestion</th>
              </tr>
            </thead>
            <tbody>
              ${issueRows}
            </tbody>
          </table>`}
    </main>
  </div>

  <script>
    const severityFilter = document.getElementById('severity-filter');
    const categoryFilter = document.getElementById('category-filter');
    const searchFilter = document.getElementById('search-filter');
    const rows = document.querySelectorAll('tbody tr');

    function filter() {
      const sev = severityFilter.value;
      const cat = categoryFilter.value;
      const term = searchFilter.value.toLowerCase();
      rows.forEach(row => {
        const matchSev = !sev || row.dataset.severity === sev;
        const matchCat = !cat || row.dataset.category === cat;
        const text = row.innerText.toLowerCase();
        const matchTerm = !term || text.includes(term);
        row.style.display = matchSev && matchCat && matchTerm ? '' : 'none';
      });
    }

    severityFilter.addEventListener('change', filter);
    categoryFilter.addEventListener('change', filter);
    searchFilter.addEventListener('input', filter);
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function groupCount<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
