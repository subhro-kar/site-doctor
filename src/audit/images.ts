import { request } from "undici";
import { normalizeUrl } from "../utils/url.js";
import type { AuditConfig, Issue, PageData, PageImage } from "../types.js";

const LARGE_IMAGE_BYTES = 1024 * 1024; // 1 MB

export async function checkImages(
  pages: PageData[],
  config: AuditConfig,
): Promise<Issue[]> {
  if (!config.checks.images) return [];

  const seen = new Map<string, { status?: number; contentType?: string; size?: number; error?: string }>();
  const issues: Issue[] = [];

  for (const page of pages) {
    for (const image of page.images) {
      if (!image.src) continue;
      const resolved = normalizeUrl(image.src, page.finalUrl);

      const cached = seen.get(resolved);
      let status = cached?.status;
      let contentType = cached?.contentType;
      let size = cached?.size;
      let error = cached?.error;

      if (!cached) {
        try {
          const result = await checkImageUrl(resolved);
          status = result.status;
          contentType = result.contentType;
          size = result.size;
          error = result.error;
          seen.set(resolved, { status, contentType, size, error });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          seen.set(resolved, { error });
        }
      }

      if (status && status >= 400) {
        issues.push({
          id: `broken-image-${status}`,
          severity: "high",
          category: "images",
          page: page.url,
          target: resolved,
          message: `Broken image (${status}).`,
          suggestion: "Fix the image src or remove the image.",
        });
      } else if (error) {
        issues.push({
          id: "image-check-failed",
          severity: "medium",
          category: "images",
          page: page.url,
          target: resolved,
          message: `Image could not be checked: ${error}`,
          suggestion: "Verify the image URL is reachable.",
        });
      } else if (contentType && !contentType.startsWith("image/")) {
        issues.push({
          id: "image-invalid-content-type",
          severity: "medium",
          category: "images",
          page: page.url,
          target: resolved,
          message: `Image returned unexpected content-type: ${contentType}.`,
          suggestion: "Ensure the image URL points to an image file.",
        });
      }

      issues.push(...checkImageQuality(image, resolved, page.url, size));
    }
  }

  return issues;
}

async function checkImageUrl(
  url: string,
): Promise<{ status?: number; contentType?: string; size?: number; error?: string }> {
  const head = await fetchImage(url, "HEAD");
  if (head.status === 405 || head.error) {
    return fetchImage(url, "GET");
  }
  return head;
}

async function fetchImage(
  url: string,
  method: "HEAD" | "GET",
): Promise<{ status?: number; contentType?: string; size?: number; error?: string }> {
  try {
    const { statusCode, headers } = await request(url, {
      method,
      headers: { "user-agent": "site-doctor/0.1.0" },
      signal: AbortSignal.timeout(10000),
    });

    const rawContentType = headers["content-type"];
    const contentType = rawContentType
      ? (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType).toLowerCase()
      : undefined;
    const rawLength = headers["content-length"];
    const size = rawLength
      ? Number(Array.isArray(rawLength) ? rawLength[0] : rawLength)
      : undefined;

    return { status: statusCode, contentType, size };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
}

function checkImageQuality(
  image: PageImage,
  resolvedUrl: string,
  pageUrl: string,
  size?: number,
): Issue[] {
  const issues: Issue[] = [];

  if (image.alt === null || image.alt === undefined) {
    issues.push({
      id: "image-missing-alt",
      severity: "high",
      category: "images",
      page: pageUrl,
      target: resolvedUrl,
      message: "Image is missing alt text.",
      suggestion: "Add descriptive alt text or alt=\"\" for decorative images.",
    });
  } else if (image.alt.trim() === "") {
    // Empty alt is valid for decorative images, but flag as info for review.
    issues.push({
      id: "image-empty-alt",
      severity: "info",
      category: "images",
      page: pageUrl,
      target: resolvedUrl,
      message: "Image has empty alt text (ok if decorative).",
    });
  }

  const hasExplicitSize =
    (image.width && image.width > 0) || (image.height && image.height > 0);
  if (!hasExplicitSize) {
    issues.push({
      id: "image-missing-dimensions",
      severity: "low",
      category: "images",
      page: pageUrl,
      target: resolvedUrl,
      message: "Image is missing explicit width or height.",
      suggestion: "Add width and height attributes to reduce layout shift.",
    });
  }

  if (size && size > LARGE_IMAGE_BYTES) {
    issues.push({
      id: "image-oversized",
      severity: "medium",
      category: "images",
      page: pageUrl,
      target: resolvedUrl,
      message: `Image is large (${formatBytes(size)}).`,
      suggestion: "Compress, resize, or use modern image formats.",
    });
  }

  if (image.isHero && image.loading === "lazy") {
    issues.push({
      id: "hero-image-lazy",
      severity: "medium",
      category: "images",
      page: pageUrl,
      target: resolvedUrl,
      message: "Hero image is lazy-loaded.",
      suggestion: "Remove loading=\"lazy\" from above-the-fold hero images.",
    });
  }

  return issues;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
