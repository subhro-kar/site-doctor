import { normalizeUrl } from "../utils/url.js";
import type { AuditConfig, Issue, PageData } from "../types.js";

export function checkMetadata(
  pages: PageData[],
  config: AuditConfig,
): Issue[] {
  if (!config.checks.metadata) return [];

  const issues: Issue[] = [];

  for (const page of pages) {
    if (!page.title || page.title.trim() === "") {
      issues.push({
        id: "missing-title",
        severity: "high",
        category: "metadata",
        page: page.url,
        message: "Missing or empty <title>.",
        suggestion: "Add a unique, descriptive <title>.",
      });
    }

    if (!page.description || page.description.trim() === "") {
      issues.push({
        id: "missing-description",
        severity: "medium",
        category: "metadata",
        page: page.url,
        message: "Missing meta description.",
        suggestion: "Add a concise meta description.",
      });
    }

    if (!page.canonical) {
      issues.push({
        id: "missing-canonical",
        severity: "low",
        category: "metadata",
        page: page.url,
        message: "Missing canonical URL.",
        suggestion: "Add a rel=canonical link to avoid duplicate content issues.",
      });
    } else {
      const resolvedCanonical = normalizeUrl(page.canonical, page.finalUrl);
      if (resolvedCanonical !== normalizeUrl(page.finalUrl, page.finalUrl)) {
        issues.push({
          id: "canonical-mismatch",
          severity: "low",
          category: "metadata",
          page: page.url,
          target: resolvedCanonical,
          message: "Canonical URL does not match the page URL.",
          suggestion: "Verify the canonical points to the preferred version of the page.",
        });
      }
    }

    if (!page.ogImage) {
      issues.push({
        id: "missing-og-image",
        severity: "info",
        category: "metadata",
        page: page.url,
        message: "Missing Open Graph image.",
        suggestion: "Add og:image for better social sharing previews.",
      });
    }

    if (page.h1s.length === 0) {
      issues.push({
        id: "missing-h1",
        severity: "medium",
        category: "metadata",
        page: page.url,
        message: "Missing <h1>.",
        suggestion: "Add a single, descriptive <h1> to each page.",
      });
    } else if (page.h1s.length > 1) {
      issues.push({
        id: "multiple-h1s",
        severity: "low",
        category: "metadata",
        page: page.url,
        message: `Multiple <h1> elements found (${page.h1s.length}).`,
        suggestion: "Use only one <h1> per page.",
      });
    }
  }

  return issues;
}
