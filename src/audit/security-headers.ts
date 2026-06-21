import type { AuditConfig, Issue, PageData } from "../types.js";

export function checkSecurityHeaders(
  pages: PageData[],
  config: AuditConfig,
): Issue[] {
  if (!config.checks.securityHeaders) return [];

  const issues: Issue[] = [];

  for (const page of pages) {
    const headers = page.headers;
    const pageUrl = page.url;

    if (!hasHeader(headers, "content-security-policy")) {
      issues.push({
        id: "missing-csp",
        severity: "medium",
        category: "security",
        page: pageUrl,
        message: "Missing Content-Security-Policy header.",
        suggestion: "Add a CSP header to mitigate XSS and data injection attacks.",
      });
    }

    const isHttps = pageUrl.startsWith("https://");
    if (isHttps && !hasHeader(headers, "strict-transport-security")) {
      issues.push({
        id: "missing-hsts",
        severity: "medium",
        category: "security",
        page: pageUrl,
        message: "Missing Strict-Transport-Security header on HTTPS page.",
        suggestion: "Add HSTS to enforce HTTPS.",
      });
    }

    if (!hasHeader(headers, "x-content-type-options")) {
      issues.push({
        id: "missing-x-content-type-options",
        severity: "low",
        category: "security",
        page: pageUrl,
        message: "Missing X-Content-Type-Options header.",
        suggestion: "Set X-Content-Type-Options: nosniff to prevent MIME sniffing.",
      });
    }

    if (!hasHeader(headers, "referrer-policy")) {
      issues.push({
        id: "missing-referrer-policy",
        severity: "low",
        category: "security",
        page: pageUrl,
        message: "Missing Referrer-Policy header.",
        suggestion: "Set a Referrer-Policy to control referrer information leakage.",
      });
    }

    if (!hasHeader(headers, "permissions-policy")) {
      issues.push({
        id: "missing-permissions-policy",
        severity: "info",
        category: "security",
        page: pageUrl,
        message: "Missing Permissions-Policy header.",
        suggestion: "Set Permissions-Policy to restrict browser features.",
      });
    }

    const hasFrameOptions = hasHeader(headers, "x-frame-options");
    const csp = headers["content-security-policy"] ?? "";
    const hasFrameAncestors = csp.toLowerCase().includes("frame-ancestors");
    if (!hasFrameOptions && !hasFrameAncestors) {
      issues.push({
        id: "missing-frame-protection",
        severity: "medium",
        category: "security",
        page: pageUrl,
        message: "Missing clickjacking protection (X-Frame-Options or CSP frame-ancestors).",
        suggestion: "Add X-Frame-Options: DENY or CSP frame-ancestors directive.",
      });
    }
  }

  return issues;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(headers, name);
}
