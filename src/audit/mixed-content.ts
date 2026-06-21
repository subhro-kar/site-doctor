import { normalizeUrl, isSameOrigin } from "../utils/url.js";
import type { AuditConfig, Issue, PageData } from "../types.js";

export function checkMixedContent(
  pages: PageData[],
  config: AuditConfig,
): Issue[] {
  if (!config.checks.mixedContent) return [];

  const issues: Issue[] = [];
  const baseOrigin = new URL(config.url).origin;

  for (const page of pages) {
    if (!page.url.startsWith("https://")) continue;

    const resourceUrls = [
      ...page.scripts,
      ...page.stylesheets,
      ...page.images.map((img) => img.src),
    ];

    for (const resource of page.resources) {
      resourceUrls.push(resource.url);
    }

    const seen = new Set<string>();
    for (const url of resourceUrls) {
      if (!url) continue;
      const resolved = normalizeUrl(url, page.finalUrl);
      if (seen.has(resolved)) continue;
      seen.add(resolved);

      if (resolved.startsWith("http://") && !isSameOrigin(resolved, baseOrigin)) {
        issues.push({
          id: "mixed-content",
          severity: "high",
          category: "mixed-content",
          page: page.url,
          target: resolved,
          message: "Mixed content: HTTP resource loaded on HTTPS page.",
          suggestion: "Serve the resource over HTTPS or remove it.",
        });
      }
    }
  }

  return issues;
}
