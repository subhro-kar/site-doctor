import { request } from "undici";
import { normalizeUrl, isSameOrigin } from "../utils/url.js";
import type { AuditConfig, Issue, PageData } from "../types.js";

const EXTERNAL_TIMEOUT = 10000;
const MAX_REDIRECTS = 5;

export async function checkLinks(
  pages: PageData[],
  config: AuditConfig,
): Promise<Issue[]> {
  if (!config.checks.links) return [];

  const baseOrigin = new URL(config.url).origin;
  const seen = new Map<string, { status?: number; error?: string; redirectLoop?: boolean }>();
  const issues: Issue[] = [];

  for (const page of pages) {
    for (const link of page.links) {
      const resolved = normalizeUrl(link.href, page.finalUrl);
      if (!resolved.startsWith("http")) continue;

      const isInternal = isSameOrigin(resolved, baseOrigin);
      const cached = seen.get(resolved);

      let status = cached?.status;
      let error = cached?.error;
      let redirectLoop = cached?.redirectLoop;

      if (!cached) {
        try {
          const result = await checkUrl(resolved, isInternal);
          status = result.status;
          redirectLoop = result.redirectLoop;
          error = result.error;
          seen.set(resolved, { status, redirectLoop, error });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          seen.set(resolved, { error });
        }
      }

      if (status && status >= 400) {
        if (!isInternal && isBotProtection(status)) {
          issues.push({
            id: `external-link-blocked-${status}`,
            severity: "low",
            category: "links",
            page: page.url,
            target: resolved,
            message: `External link returned ${status} (likely bot protection; verify manually).`,
            suggestion: "Open the link in a browser to confirm it works.",
          });
        } else {
          issues.push({
            id: `broken-link-${status}`,
            severity: isInternal ? "high" : "medium",
            category: "links",
            page: page.url,
            target: resolved,
            message: `Broken ${isInternal ? "internal" : "external"} link (${status}).`,
            suggestion: "Fix or remove the link.",
          });
        }
      } else if (redirectLoop) {
        issues.push({
          id: "redirect-loop",
          severity: "high",
          category: "links",
          page: page.url,
          target: resolved,
          message: "Redirect loop detected.",
          suggestion: "Update the link to its final destination.",
        });
      } else if (error) {
        issues.push({
          id: "link-check-failed",
          severity: isInternal ? "high" : "low",
          category: "links",
          page: page.url,
          target: resolved,
          message: `Link could not be checked: ${error}`,
          suggestion: isInternal
            ? "Verify the link points to a working page."
            : "External link timed out or blocked; check manually.",
        });
      }
    }
  }

  return issues;
}

function isBotProtection(status: number): boolean {
  // 999 = LinkedIn scraper block, 403 = generic forbidden (often bot protection)
  return status === 999 || status === 403;
}

async function checkUrl(
  url: string,
  isInternal: boolean,
): Promise<{ status?: number; redirectLoop?: boolean; error?: string }> {
  const timeout = isInternal ? 10000 : EXTERNAL_TIMEOUT;
  const result = await fetchWithRedirects(url, "HEAD", timeout);

  if (result.status === 405 || result.error === "timeout" || result.error === "aborted") {
    return fetchWithRedirects(url, "GET", timeout);
  }

  return result;
}

async function fetchWithRedirects(
  url: string,
  method: "HEAD" | "GET",
  timeout: number,
): Promise<{ status?: number; redirectLoop?: boolean; error?: string }> {
  const redirects = new Set<string>();
  let current = url;

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    try {
      const { statusCode, headers } = await request(current, {
        method,
        headers: { "user-agent": "site-doctor/0.1.0" },
        signal: AbortSignal.timeout(timeout),
      });

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        const location = Array.isArray(headers.location) ? headers.location[0] : headers.location;
        const next = normalizeUrl(location, current);
        if (redirects.has(next)) {
          return { redirectLoop: true };
        }
        redirects.add(next);
        current = next;
        continue;
      }

      return { status: statusCode };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("aborted") || message.includes("timeout")) {
        return { error: "timeout" };
      }
      return { error: message };
    }
  }

  return { redirectLoop: true };
}
