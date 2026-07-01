import type { Page } from "playwright";
import type { AuditConfig, Issue, PageData } from "../types.js";

type PerfMetric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
};

type RenderBlockingResource = {
  url: string;
  type: string;
};

type PerformanceFinding = {
  id: string;
  severity: string;
  message: string;
  target?: string;
  selector?: string;
  suggestion?: string;
};

export async function checkPerformance(
  pages: PageData[],
  config: AuditConfig,
  getPage: () => Promise<Page>,
  closePage: (page: Page) => Promise<void>,
): Promise<Issue[]> {
  if (!config.checks.performance) return [];

  const issues: Issue[] = [];

  for (const pageData of pages) {
    const page = await getPage();
    try {
      await page.goto(pageData.url, { waitUntil: "load", timeout: 30000 });

      const metrics = await page.evaluate(performanceAuditScript);

      for (const finding of metrics) {
        issues.push({
          id: finding.id,
          severity: finding.severity as Issue["severity"],
          category: "performance",
          page: pageData.url,
          message: finding.message,
          target: finding.target ?? undefined,
          selector: finding.selector ?? undefined,
          suggestion: finding.suggestion ?? undefined,
        });
      }
    } catch {
      issues.push({
        id: "performance-check-failed",
        severity: "medium",
        category: "performance",
        page: pageData.url,
        message: "Performance check failed: page could not be analyzed.",
        suggestion: "Ensure the page is fully loaded and accessible.",
      });
    } finally {
      await closePage(page);
    }
  }

  return issues;
}

function performanceAuditScript(): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  // ── Core Web Vitals (LCP, CLS, INP) ──

  type PerformanceEntryLike = {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
    value?: number;
    hadRecentInput?: boolean;
  };

  const perfEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const resourceEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

  // ── LCP (Largest Contentful Paint) ──

  const lcpEntries = (performance.getEntriesByType("element") as PerformanceEntryLike[])
    .filter((e) => e.name === "largest-contentful-paint")
    .sort((a, b) => b.startTime - a.startTime);

  if (lcpEntries.length > 0) {
    const lcp = lcpEntries[0].startTime;
    const rating: PerfMetric["rating"] = lcp <= 2500 ? "good" : lcp <= 4000 ? "needs-improvement" : "poor";
    if (rating !== "good") {
      findings.push({
        id: "slow-lcp",
        severity: rating === "poor" ? "high" : "medium",
        message: `Largest Contentful Paint (LCP) is ${Math.round(lcp)}ms (${rating === "poor" ? "poor" : "needs improvement"}).`,
        suggestion: "Optimize LCP element: preload images, eliminate render-blocking resources, use CDN, compress images.",
      });
    }
  } else {
    // Fallback: estimate LCP from navigation timing
    if (perfEntries.length > 0) {
      const nav = perfEntries[0];
      const domContentLoaded = nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart;
      if (nav.loadEventEnd > 0) {
        const loadTime = nav.loadEventEnd - nav.startTime;
        if (loadTime > 4000) {
          findings.push({
            id: "slow-page-load",
            severity: loadTime > 8000 ? "high" : "medium",
            message: `Page load time is ${Math.round(loadTime)}ms, which is ${loadTime > 8000 ? "very slow" : "slower than recommended"}.`,
            suggestion: "Reduce page load time: optimize images, eliminate render-blocking resources, enable compression, use a CDN.",
          });
        }
      }
    }
  }

  // ── CLS (Cumulative Layout Shift) ──

  const clsEntries = (performance.getEntriesByType("layout-shift") as PerformanceEntryLike[])
    .filter((e) => !e.hadRecentInput);

  if (clsEntries.length > 0) {
    const totalCls = clsEntries.reduce((sum, e) => sum + (e.value ?? 0), 0);
    if (totalCls > 0.25) {
      findings.push({
        id: "high-cls",
        severity: "high",
        message: `Cumulative Layout Shift (CLS) is ${totalCls.toFixed(3)}, which is poor (>0.25).`,
        suggestion: "Set explicit dimensions on images/videos, avoid dynamic content injection above fold, use font-display: swap.",
      });
    } else if (totalCls > 0.1) {
      findings.push({
        id: "moderate-cls",
        severity: "medium",
        message: `Cumulative Layout Shift (CLS) is ${totalCls.toFixed(3)}, which needs improvement (>0.1).`,
        suggestion: "Set explicit dimensions on images/videos, reserve space for dynamic content, use font-display: swap.",
      });
    }
  }

  // ── FID / INP (Interaction to Next Paint) ──

  const eventEntries = (performance.getEntriesByType("event") as PerformanceEntryLike[]);
  if (eventEntries.length > 0) {
    const slowEvents = eventEntries.filter((e) => e.duration > 200);
    if (slowEvents.length > 0) {
      const maxDuration = Math.max(...eventEntries.map((e) => e.duration));
      findings.push({
        id: "slow-interaction",
        severity: maxDuration > 500 ? "high" : "medium",
        message: `${slowEvents.length} slow interaction(s) detected. Max INP: ${Math.round(maxDuration)}ms.`,
        suggestion: "Reduce JavaScript execution time, break up long tasks, use requestIdleCallback for non-critical work.",
      });
    }
  }

  // ── DOM Size ──

  const domSize = document.querySelectorAll("*").length;
  if (domSize > 1500) {
    findings.push({
      id: "large-dom",
      severity: domSize > 3000 ? "high" : "medium",
      message: `DOM has ${domSize} elements, which is ${domSize > 3000 ? "excessively" : "quite"} large.`,
      suggestion: "Reduce DOM size to under 1500 elements for better rendering performance. Use virtualization for long lists.",
    });
  }

  // ── JavaScript Bundle Size ──

  const jsResources = resourceEntries.filter(
    (r) => r.initiatorType === "script" || r.name.match(/\.(js|mjs)(\?|$)/),
  );
  let totalJsSize = 0;
  for (const r of jsResources) {
    totalJsSize += r.transferSize ?? r.encodedBodySize ?? 0;
  }

  if (totalJsSize > 500 * 1024) {
    findings.push({
      id: "large-js-bundle",
      severity: totalJsSize > 1024 * 1024 ? "high" : "medium",
      message: `Total JavaScript transfer size is ${(totalJsSize / 1024).toFixed(0)}KB, which is ${totalJsSize > 1024 * 1024 ? "excessively" : ""} large.`,
      suggestion: "Code-split your JavaScript, tree-shake unused exports, lazy-load non-critical scripts.",
    });
  }

  // ── CSS Bundle Size ──

  const cssResources = resourceEntries.filter(
    (r) => r.initiatorType === "link" || r.name.match(/\.css(\?|$)/),
  );
  let totalCssSize = 0;
  for (const r of cssResources) {
    totalCssSize += r.transferSize ?? r.encodedBodySize ?? 0;
  }

  if (totalCssSize > 100 * 1024) {
    findings.push({
      id: "large-css-bundle",
      severity: totalCssSize > 200 * 1024 ? "medium" : "low",
      message: `Total CSS transfer size is ${(totalCssSize / 1024).toFixed(0)}KB, which is larger than recommended.`,
      suggestion: "Remove unused CSS, consider critical CSS inlining, use CSS containment.",
    });
  }

  // ── Render-Blocking Resources ──

  const renderBlockingResources: RenderBlockingResource[] = [];

  for (const r of resourceEntries) {
    if ((r as PerformanceResourceTiming & { renderBlockingStatus?: string }).renderBlockingStatus === "blocking") {
      renderBlockingResources.push({
        url: r.name,
        type: r.initiatorType === "link" ? "stylesheet" : "script",
      });
    }
  }

  // Fallback: detect render-blocking from <link> and <script> tags in <head>
  if (renderBlockingResources.length === 0) {
    const headScripts = Array.from(document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])'));
    const headStyles = Array.from(document.querySelectorAll('head link[rel="stylesheet"]:not([media="print"])'));

    for (const s of headScripts) {
      renderBlockingResources.push({
        url: (s as HTMLScriptElement).src || "(inline)",
        type: "script",
      });
    }
    for (const l of headStyles) {
      renderBlockingResources.push({
        url: (l as HTMLLinkElement).href || "(inline)",
        type: "stylesheet",
      });
    }
  }

  if (renderBlockingResources.length > 3) {
    findings.push({
      id: "many-render-blocking-resources",
      severity: "high",
      message: `${renderBlockingResources.length} render-blocking resources detected (${renderBlockingResources.filter((r) => r.type === "script").length} scripts, ${renderBlockingResources.filter((r) => r.type === "stylesheet").length} stylesheets).`,
      suggestion: "Add async/defer to scripts, inline critical CSS, lazy-load non-critical stylesheets.",
    });
  } else if (renderBlockingResources.length > 0) {
    findings.push({
      id: "render-blocking-resources",
      severity: "low",
      message: `${renderBlockingResources.length} render-blocking resource(s) detected: ${renderBlockingResources.slice(0, 3).map((r) => r.url.split("/").pop()).join(", ")}.`,
      suggestion: "Consider adding async/defer to scripts or inlining critical CSS.",
    });
  }

  // ── Uncompressed Resources ──

  let uncompressedCount = 0;
  for (const r of resourceEntries) {
    if (r.decodedBodySize > 0 && r.encodedBodySize > 0) {
      const compressionRatio = r.decodedBodySize / r.encodedBodySize;
      if (compressionRatio < 1.5 && r.decodedBodySize > 10 * 1024) {
        uncompressedCount++;
      }
    }
  }

  if (uncompressedCount > 0) {
    findings.push({
      id: "uncompressed-resources",
      severity: "medium",
      message: `${uncompressedCount} resource(s) appear to be served without compression (gzip/brotli).`,
      suggestion: "Enable gzip or brotli compression on your server for text-based assets.",
    });
  }

  // ── Third-Party Resources ──

  const currentHost = location.hostname;
  const thirdPartyHosts = new Set<string>();
  for (const r of resourceEntries) {
    try {
      const url = new URL(r.name);
      if (url.hostname !== currentHost && !url.hostname.endsWith("." + currentHost.split(".").slice(-2).join("."))) {
        thirdPartyHosts.add(url.hostname);
      }
    } catch {
      // skip invalid URLs
    }
  }

  if (thirdPartyHosts.size > 8) {
    findings.push({
      id: "many-third-party-hosts",
      severity: "medium",
      message: `${thirdPartyHosts.size} different third-party hosts loaded: ${Array.from(thirdPartyHosts).slice(0, 5).join(", ")}, ...`,
      suggestion: "Reduce third-party scripts to improve load performance. Consider self-hosting or using facades for analytics/chat widgets.",
    });
  }

  // ── Images Without Size Attributes ──

  const images = Array.from(document.querySelectorAll("img"));
  let imagesWithoutSize = 0;
  for (const img of images) {
    if (!img.hasAttribute("width") || !img.hasAttribute("height")) {
      const src = img.getAttribute("src") ?? "";
      if (src && !src.startsWith("data:") && src.includes(".")) {
        imagesWithoutSize++;
      }
    }
  }

  if (imagesWithoutSize > 0) {
    findings.push({
      id: "images-without-size",
      severity: "medium",
      message: `${imagesWithoutSize} <img> element(s) missing width or height attributes, which may cause layout shifts.`,
      suggestion: "Always set width and height attributes on images to prevent Cumulative Layout Shift.",
    });
  }

  return findings;
}