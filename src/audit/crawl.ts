import { chromium, type Browser, type Page, type ConsoleMessage } from "playwright";
import { normalizeUrl, isSameOrigin, isLikelyDownload } from "../utils/url.js";
import { isBrowserNotInstalledError, installBrowsers } from "../utils/browser.js";
import { resolveSourceFile } from "../project/resolve-source-file.js";
import type { PageData, PageResource, ConsoleMessage as SiteConsoleMessage } from "../types.js";

const chromiumArgs = process.platform === "win32"
  ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-features=NetworkService"]
  : [];

export type CrawlOptions = {
  startUrl: string;
  maxPages: number;
  projectDir?: string;
};

export async function crawl(options: CrawlOptions): Promise<PageData[]> {
  const { startUrl, maxPages, projectDir } = options;
  const baseOrigin = new URL(startUrl).origin;

  console.error(`Crawling ${startUrl} (max ${maxPages} pages)...`);

  let browser: Browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: chromiumArgs,
    });
  } catch (error) {
    if (isBrowserNotInstalledError(error)) {
      installBrowsers();
      browser = await chromium.launch({
        headless: true,
        args: chromiumArgs,
      });
    } else {
      throw error;
    }
  }
  const context = await browser.newContext();
  const page = await context.newPage();

  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(startUrl, startUrl)];
  const pages: PageData[] = [];
  let isFirstPage = true;

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      const pageData = await crawlPage(page, url, baseOrigin);
      if (pageData) {
        if (projectDir) {
          const urlPath = new URL(pageData.finalUrl).pathname;
          pageData.sourceFile = resolveSourceFile(projectDir, urlPath);
        }
        pages.push(pageData);
        console.error(`  [${pages.length}/${maxPages}] ${pageData.statusCode} ${pageData.finalUrl}`);

        if (isFirstPage && pageData.statusCode === 0) {
          const navError = pageData.pageErrors.find((e) => e.name === "NavigationError");
          const message = stripAnsi(navError?.message ?? "unknown navigation error");
          throw new Error(`Could not reach ${startUrl}: ${message}`);
        }
        isFirstPage = false;

        for (const link of pageData.links) {
          const normalized = normalizeUrl(link.href, pageData.finalUrl);
          if (
            !visited.has(normalized) &&
            isSameOrigin(normalized, baseOrigin) &&
            !isLikelyDownload(normalized)
          ) {
            queue.push(normalized);
          }
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.error(`Crawled ${pages.length} page(s).\n`);
  return pages;
}

async function crawlPage(
  page: Page,
  url: string,
  baseOrigin: string,
): Promise<PageData | null> {
  const consoleMessages: SiteConsoleMessage[] = [];
  const pageErrors: PageData["pageErrors"] = [];
  const resources: PageResource[] = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    const type = msg.type() as SiteConsoleMessage["type"];
    if (["error", "warn"].includes(type)) {
      consoleMessages.push({
        type,
        text: msg.text(),
        location: msg.location()?.url,
      });
    }
  };

  const errorHandler = (error: Error) => {
    pageErrors.push({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  };

  const requestHandler = (request: { url: () => string; resourceType: () => string }) => {
    resources.push({
      url: request.url(),
      resourceType: request.resourceType(),
    });
  };

  const responseHandler = (response: {
    url: () => string;
    status: () => number;
    headers: () => Record<string, string>;
  }) => {
    const resource = resources.find((r) => r.url === response.url());
    if (resource) {
      resource.status = response.status();
      resource.contentType = response.headers()["content-type"];
    }
  };

  page.on("console", consoleHandler);
  page.on("pageerror", errorHandler);
  page.on("request", requestHandler);
  page.on("response", responseHandler);

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const finalUrl = page.url();
    const statusCode = response?.status() ?? 0;
    const headers: Record<string, string> = {};
    response?.headers() &&
      Object.entries(response.headers()).forEach(([key, value]) => {
        headers[key.toLowerCase()] = value;
      });

    const extracted = await page.evaluate(() => {
      const title = document.querySelector("title")?.textContent?.trim() ?? null;
      const description =
        document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? null;
      const canonical =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? null;
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim() ??
        null;
      const h1s = Array.from(document.querySelectorAll("h1"))
        .map((el) => (el as HTMLElement).textContent?.trim())
        .filter((t): t is string => Boolean(t));

      const links = Array.from(document.querySelectorAll("a[href]")).map((el) => ({
        href: (el as HTMLElement).getAttribute("href") ?? "",
        text: (el as HTMLElement).textContent?.trim() ?? "",
      }));

      const images = Array.from(document.querySelectorAll("img")).map((el, index) => {
        const img = el as HTMLImageElement;
        const rect = img.getBoundingClientRect();
        const isHero = index === 0 && rect.top < window.innerHeight * 0.5;
        return {
          src: img.getAttribute("src") ?? "",
          alt: img.getAttribute("alt"),
          width: img.naturalWidth || undefined,
          height: img.naturalHeight || undefined,
          loading: img.getAttribute("loading") ?? undefined,
          isHero,
        };
      });

      const scripts = Array.from(document.querySelectorAll("script[src]"))
        .map((el) => (el as HTMLElement).getAttribute("src") ?? "")
        .filter(Boolean);

      const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((el) => (el as HTMLElement).getAttribute("href") ?? "")
        .filter(Boolean);

      return {
        title,
        description,
        canonical,
        ogImage,
        h1s,
        links,
        images,
        scripts,
        stylesheets,
      };
    });

    return {
      url,
      finalUrl,
      statusCode,
      headers,
      ...extracted,
      consoleMessages,
      pageErrors,
      resources,
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      statusCode: 0,
      headers: {},
      title: null,
      description: null,
      canonical: null,
      ogImage: null,
      h1s: [],
      links: [],
      images: [],
      scripts: [],
      stylesheets: [],
      consoleMessages,
      pageErrors: [
        ...pageErrors,
        {
          name: "NavigationError",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      resources,
    };
  } finally {
    page.removeListener("console", consoleHandler);
    page.removeListener("pageerror", errorHandler);
    page.removeListener("request", requestHandler);
    page.removeListener("response", responseHandler);
  }
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
