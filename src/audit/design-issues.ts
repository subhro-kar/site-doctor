import type { Page } from "playwright";
import type { AuditConfig, Issue, PageData } from "../types.js";

type DesignFinding = {
  id: string;
  severity: string;
  message: string;
  target?: string;
  selector?: string;
  suggestion?: string;
};

type HeadingInfo = { el: Element; level: number; text: string };
type Rgb = { r: number; g: number; b: number; a: number };

export async function checkDesignIssues(
  pages: PageData[],
  config: AuditConfig,
  getPage: () => Promise<Page>,
  closePage: (page: Page) => Promise<void>,
): Promise<Issue[]> {
  if (!config.checks.designIssues) return [];

  const issues: Issue[] = [];
  const MOBILE_VIEWPORT = { width: 375, height: 812 };

  for (const pageData of pages) {
    const page = await getPage();
    try {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(pageData.url, { waitUntil: "networkidle", timeout: 30000 });
      const findings = await page.evaluate(designAuditScript);

      for (const finding of findings) {
        issues.push({
          id: finding.id,
          severity: finding.severity as Issue["severity"],
          category: "design",
          page: pageData.url,
          message: finding.message,
          target: finding.target ?? undefined,
          selector: finding.selector ?? undefined,
          suggestion: finding.suggestion ?? undefined,
        });
      }
    } catch {
      issues.push({
        id: "design-check-failed",
        severity: "medium",
        category: "design",
        page: pageData.url,
        message: "Design check failed: page could not be analyzed.",
        suggestion: "Ensure the page is fully loaded and accessible.",
      });
    } finally {
      await closePage(page);
    }
  }

  return issues;
}

function designAuditScript(): DesignFinding[] {
  const findings: DesignFinding[] = [];
  const allElements = Array.from(document.querySelectorAll("*"));
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  const headingLevels: HeadingInfo[] = headings.map((h) => ({
    el: h,
    level: Number.parseInt(h.tagName[1], 10),
    text: (h as HTMLElement).textContent?.trim() ?? "",
  }));
  const paragraphs = Array.from(document.querySelectorAll("p, li, td, span"));
  const bodyFontSize = Number.parseFloat(getComputedStyle(document.body).fontSize);

  // ── Helper ──

  function buildSelector(el: Element): string {
    const path: string[] = [];
    let current: Element | null = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === current!.tagName,
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  // ── Heading Hierarchy ──

  if (headingLevels.length > 0) {
    for (let i = 1; i < headingLevels.length; i++) {
      const prev = headingLevels[i - 1].level;
      const curr = headingLevels[i].level;
      if (curr > prev + 1) {
        findings.push({
          id: "skipped-heading-level",
          severity: "medium",
          message: `Heading level skipped: h${prev} followed by h${curr}.`,
          selector: headingLevels[i].el.tagName.toLowerCase() + ":nth-of-type(" + (i + 1) + ")",
          target: headingLevels[i].text.slice(0, 80) || undefined,
          suggestion: "Use sequential heading levels (h1 → h2 → h3) for proper document structure.",
        });
      }
    }

    const uniqueLevels = new Set(headingLevels.map((h) => h.level));
    if (uniqueLevels.size > 4) {
      const maxLevel = Math.max(...headingLevels.map((h) => h.level));
      const minLevel = Math.min(...headingLevels.map((h) => h.level));
      findings.push({
        id: "too-many-heading-levels",
        severity: "low",
        message: `${uniqueLevels.size} heading levels used (h${minLevel}–h${maxLevel}), consider simplifying.`,
        suggestion: "Limit to 3–4 heading levels per page for better scannability.",
      });
    }

    for (const h of headingLevels) {
      if (h.text.length === 0) {
        findings.push({
          id: "empty-heading",
          severity: "medium",
          message: `Empty <${h.el.tagName.toLowerCase()}> element found.`,
          selector: buildSelector(h.el),
          suggestion: "Add meaningful text to heading elements or remove them.",
        });
      }
    }
  }

  // ── Typography Scale ──

  if (bodyFontSize > 0 && headingLevels.length > 0) {
    const computedStyles = new Map<Element, CSSStyleDeclaration>();
    for (const h of headingLevels) {
      computedStyles.set(h.el, getComputedStyle(h.el));
    }

    const h1s = headingLevels.filter((h) => h.level === 1);
    for (const h1 of h1s) {
      const style = computedStyles.get(h1.el);
      if (!style) continue;
      const h1Size = Number.parseFloat(style.fontSize);
      if (h1Size > 0 && h1Size < bodyFontSize * 1.2) {
        findings.push({
          id: "heading-scale-too-flat",
          severity: "medium",
          message: `H1 font size (${h1Size.toFixed(1)}px) is less than 1.2× body text (${bodyFontSize.toFixed(1)}px), creating weak visual hierarchy.`,
          selector: buildSelector(h1.el),
          suggestion: "Increase H1 size to at least 1.5× body text for clear hierarchy.",
        });
      }
    }

    const levelGroups: Record<number, HeadingInfo[]> = {};
    for (const h of headingLevels) {
      if (!levelGroups[h.level]) levelGroups[h.level] = [];
      levelGroups[h.level].push(h);
    }

    const levelAvgSize: Record<number, number> = {};
    for (const [level, items] of Object.entries(levelGroups)) {
      const sizes = items.map((h) => {
        const style = computedStyles.get(h.el);
        return style ? Number.parseFloat(style.fontSize) : 0;
      }).filter((s) => s > 0);
      if (sizes.length > 0) {
        levelAvgSize[Number(level)] = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      }
    }

    const sortedLevels = Object.keys(levelAvgSize).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < sortedLevels.length - 1; i++) {
      const curr = sortedLevels[i];
      const next = sortedLevels[i + 1];
      const currSize = levelAvgSize[curr];
      const nextSize = levelAvgSize[next];
      if (currSize <= 0 || nextSize <= 0) continue;

      if (nextSize > currSize) {
        findings.push({
          id: "broken-typographic-scale",
          severity: "high",
          message: `h${next} (${nextSize.toFixed(1)}px) is larger than h${curr} (${currSize.toFixed(1)}px), breaking typographic scale.`,
          suggestion: "Ensure heading sizes decrease with heading level (H1 > H2 > H3...).",
        });
      }

      const diff = Math.abs(currSize - nextSize);
      if (diff < 2 && diff > 0) {
        findings.push({
          id: "heading-size-too-similar",
          severity: "low",
          message: `h${curr} (${currSize.toFixed(1)}px) and h${next} (${nextSize.toFixed(1)}px) are less than 2px apart — hard to distinguish.`,
          suggestion: "Increase the size gap between adjacent heading levels to at least 2–4px.",
        });
      }
    }
  }

  // ── Typography ──

  const fontFamilies = new Set<string>();
  for (const el of allElements) {
    const family = getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/['"]/g, "");
    if (family) fontFamilies.add(family);
  }
  if (fontFamilies.size > 4) {
    findings.push({
      id: "too-many-font-families",
      severity: "medium",
      message: `${fontFamilies.size} different font families detected (${Array.from(fontFamilies).slice(0, 5).join(", ")}...).`,
      suggestion: "Limit to 2–3 font families for visual consistency.",
    });
  }

  let smallTextCount = 0;
  let smallTextExample: Element | null = null;
  for (const el of allElements) {
    const fontSize = Number.parseFloat(getComputedStyle(el).fontSize);
    if (fontSize > 0 && fontSize < 10) {
      smallTextCount++;
      smallTextExample ??= el;
    }
  }
  if (smallTextCount > 0) {
    findings.push({
      id: "font-size-too-small",
      severity: "medium",
      message: `${smallTextCount} element(s) with font size below 10px detected.`,
      selector: smallTextExample ? buildSelector(smallTextExample) : undefined,
      suggestion: "Use a minimum font size of 14px for readability (10px minimum for non-body text).",
    });
  }

  let lowLineHeightCount = 0;
  let lowLineHeightExample: Element | null = null;
  for (const p of paragraphs) {
    const style = getComputedStyle(p);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const fontSize = Number.parseFloat(style.fontSize);
    if (fontSize > 0 && lineHeight > 0) {
      const ratio = lineHeight / fontSize;
      if (ratio < 1.2) {
        lowLineHeightCount++;
        lowLineHeightExample ??= p;
      }
    }
  }
  if (lowLineHeightCount > 0) {
    findings.push({
      id: "low-line-height",
      severity: "medium",
      message: `${lowLineHeightCount} element(s) with line-height below 1.2× font size, causing cramped text.`,
      selector: lowLineHeightExample ? buildSelector(lowLineHeightExample) : undefined,
      suggestion: "Use a line-height of 1.4–1.6 for body text.",
    });
  }

  for (const p of paragraphs) {
    const text = (p as HTMLElement).textContent?.trim() ?? "";
    if (text.length > 200) {
      const rect = (p as HTMLElement).getBoundingClientRect();
      if (rect.width > 900) {
        findings.push({
          id: "text-line-too-long",
          severity: "low",
          message: `Text container is ${Math.round(rect.width)}px wide, exceeding the 900px readability threshold.`,
          selector: buildSelector(p),
          suggestion: "Limit line length to 600–800px (75–80 characters) for comfortable reading.",
        });
        break;
      }
    }
  }

  // ── Text Disguised as Headings ──

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    if (!["p", "span", "div", "li", "td"].includes(tag)) continue;
    const style = getComputedStyle(el);
    const fontSize = Number.parseFloat(style.fontSize);
    const fontWeight = Number.parseInt(style.fontWeight, 10);
    const elText = (el as HTMLElement).textContent?.trim() ?? "";
    if (elText.length === 0 || elText.length > 120) continue;

    const isBold = fontWeight >= 600;
    const isBig = fontSize > bodyFontSize * 1.2;
    const isHeading = Array.from(el.children).some(
      (child) => /^H[1-6]$/.test((child as Element).tagName),
    );
    if (isHeading) continue;

    if (isBig && isBold) {
      const parentHeading = el.parentElement ? /^H[1-6]$/.test(el.parentElement.tagName) : false;
      if (!parentHeading) {
        findings.push({
          id: "text-disguised-as-heading",
          severity: "low",
          message: `Styled as heading (${fontSize.toFixed(1)}px, bold) but uses <${tag}> instead of a heading element.`,
          selector: buildSelector(el),
          target: elText.slice(0, 60),
          suggestion: "Use semantic heading tags (h1–h6) instead of styled non-heading elements.",
        });
        break;
      }
    }
  }

  // ── Color Contrast ──

  function parseRgb(color: string): Rgb | null {
    const regex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/;
    const match = regex.exec(color);
    if (!match) return null;
    return {
      r: Number.parseInt(match[1], 10),
      g: Number.parseInt(match[2], 10),
      b: Number.parseInt(match[3], 10),
      a: match[4] !== undefined ? Number.parseFloat(match[4]) : 1,
    };
  }

  function luminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const normalized = c / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrastRatio(fg: Rgb, bg: Rgb): number {
    const blendedFg = {
      r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
      g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
      b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    };
    const l1 = luminance(blendedFg.r, blendedFg.g, blendedFg.b);
    const l2 = luminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const contrastElements = Array.from(
    document.querySelectorAll("p, span, a, li, h1, h2, h3, h4, h5, h6, label, button, td, th, div"),
  );
  let lowContrastCount = 0;
  const lowContrastExamples: { selector: string; ratio: number; target?: string }[] = [];

  for (const el of contrastElements) {
    if (lowContrastCount >= 5) break;
    const style = getComputedStyle(el);
    const fg = style.color;
    const bg = style.backgroundColor;
    if (!fg || !bg) continue;

    const fgRgb = parseRgb(fg);
    const bgRgb = parseRgb(bg);
    if (!fgRgb || !bgRgb) continue;
    if (bgRgb.a === 0) continue;

    const ratio = contrastRatio(fgRgb, bgRgb);
    const fontSize = Number.parseFloat(style.fontSize);
    const fontWeight = Number.parseInt(style.fontWeight, 10);
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);

    const threshold = isLargeText ? 3 : 4.5;
    if (ratio < threshold) {
      lowContrastCount++;
      const text = (el as HTMLElement).textContent?.trim().slice(0, 60) ?? "";
      if (lowContrastExamples.length < 3) {
        lowContrastExamples.push({
          selector: buildSelector(el),
          ratio: Math.round(ratio * 100) / 100,
          target: text.length > 0 ? text : undefined,
        });
      }
    }
  }

  if (lowContrastCount > 0) {
    const example = lowContrastExamples[0];
    findings.push({
      id: "low-contrast-text",
      severity: "high",
      message: `${lowContrastCount} element(s) with insufficient color contrast (below ${lowContrastExamples.length > 0 ? `e.g. ${lowContrastExamples[0].ratio}:1` : "WCAG threshold"}).`,
      selector: example?.selector,
      target: example?.target,
      suggestion: "Increase contrast ratio to at least 4.5:1 for normal text or 3:1 for large text.",
    });
    for (let i = 1; i < lowContrastExamples.length; i++) {
      findings.push({
        id: "low-contrast-text",
        severity: "high",
        message: `Low contrast ratio of ${lowContrastExamples[i].ratio}:1 detected.`,
        selector: lowContrastExamples[i].selector,
        target: lowContrastExamples[i].target,
        suggestion: "Increase foreground/background contrast.",
      });
    }
  }

  // ── Touch & Interaction ──

  const interactiveSelector = "a, button, [role='button'], input[type='submit'], input[type='button'], input[type='reset'], select";
  const interactiveElements = Array.from(document.querySelectorAll(interactiveSelector));

  let smallTouchTargets = 0;
  let smallTouchExample: Element | null = null;
  for (const el of interactiveElements) {
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
      smallTouchTargets++;
      smallTouchExample ??= el;
    }
  }
  if (smallTouchTargets > 0) {
    findings.push({
      id: "small-touch-target",
      severity: "medium",
      message: `${smallTouchTargets} interactive element(s) smaller than 44×44px, which is below recommended touch target size.`,
      selector: smallTouchExample ? buildSelector(smallTouchExample) : undefined,
      suggestion: "Increase touch target size to at least 44×44px for mobile usability.",
    });
  }

  const focusableElements = Array.from(document.querySelectorAll("a, button, input, select, textarea, [tabindex]"));
  let missingFocusStyles = 0;
  let focusExample: Element | null = null;
  for (const el of focusableElements) {
    if ((el as HTMLElement).offsetParent === null) continue;
    const style = getComputedStyle(el);
    const outlineStyle = style.outlineStyle;
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const boxShadow = style.boxShadow;
    const hasOutline = outlineStyle !== "none" && outlineWidth > 0;
    const hasBoxShadow = boxShadow !== "none" && boxShadow !== "";
    if (!hasOutline && !hasBoxShadow) {
      missingFocusStyles++;
      focusExample ??= el;
    }
  }
  if (missingFocusStyles > 0) {
    findings.push({
      id: "missing-focus-style",
      severity: "medium",
      message: `${missingFocusStyles} focusable element(s) without visible focus indicator.`,
      selector: focusExample ? buildSelector(focusExample) : undefined,
      suggestion: "Add visible focus styles (outline or box-shadow) for keyboard accessibility.",
    });
  }

  // ── Responsive & Layout ──

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta === null) {
    findings.push({
      id: "missing-viewport-meta",
      severity: "high",
      message: "Missing <meta name='viewport'> tag.",
      suggestion: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> for proper mobile rendering.",
    });
  } else {
    const content = viewportMeta.getAttribute("content") ?? "";
    if (!content.includes("width=device-width")) {
      findings.push({
        id: "viewport-meta-no-device-width",
        severity: "medium",
        message: "Viewport meta tag is missing 'width=device-width'.",
        suggestion: "Include 'width=device-width' in your viewport meta tag.",
      });
    }
  }

  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
    findings.push({
      id: "horizontal-overflow",
      severity: "medium",
      message: `Page has horizontal overflow (${document.documentElement.scrollWidth}px wide vs ${document.documentElement.clientWidth}px viewport).`,
      suggestion: "Check for elements with fixed widths, negative margins, or overflow issues.",
    });
  }

  for (const h of headingLevels) {
    if (h.text.length > 70) {
      findings.push({
        id: "heading-too-long",
        severity: "low",
        message: `<${h.el.tagName.toLowerCase()}> is ${h.text.length} characters long, which reduces scannability.`,
        selector: buildSelector(h.el),
        target: h.text.slice(0, 80),
        suggestion: "Keep headings under 60–70 characters for better readability.",
      });
    }
  }

  // ── Large Text Walls ──

  for (const el of Array.from(document.querySelectorAll("p"))) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) {
      const hasSubheadings = el.parentElement
        ? el.parentElement.querySelectorAll("h2,h3,h4").length > 0
        : false;
      if (!hasSubheadings) {
        findings.push({
          id: "large-text-wall",
          severity: "low",
          message: `Paragraph with ${wordCount} words and no nearby subheadings — hard to scan.`,
          selector: buildSelector(el),
          suggestion: "Break long paragraphs into shorter sections with subheadings.",
        });
        break;
      }
    }
  }

  return findings;
}