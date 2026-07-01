export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Category =
  | "links"
  | "images"
  | "accessibility"
  | "security"
  | "console"
  | "hydration"
  | "metadata"
  | "mixed-content"
  | "performance"
  | "design";

export type Issue = {
  id: string;
  severity: Severity;
  category: Category;
  page: string;
  message: string;
  target?: string;
  selector?: string;
  suggestion?: string;
};

export type AuditConfig = {
  url: string;
  maxPages: number;
  report: "terminal" | "json" | "html";
  checks: {
    links: boolean;
    images: boolean;
    accessibility: boolean;
    securityHeaders: boolean;
    consoleErrors: boolean;
    hydrationErrors: boolean;
    metadata: boolean;
    mixedContent: boolean;
    designIssues: boolean;
    performance: boolean;
  };
};

export type AuditResult = {
  config: AuditConfig;
  pagesCrawled: number;
  pages: PageData[];
  issues: Issue[];
};

export type PageResource = {
  url: string;
  resourceType: string;
  status?: number;
  contentType?: string;
};

export type ConsoleMessage = {
  type: "log" | "warn" | "error" | "debug" | "info";
  text: string;
  location?: string;
};

export type PageError = {
  name: string;
  message: string;
  stack?: string;
};

export type PageLink = {
  href: string;
  text: string;
};

export type PageImage = {
  src: string;
  alt: string | null;
  width?: number;
  height?: number;
  loading?: string;
  isHero: boolean;
};

export type PageData = {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  sourceFile?: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1s: string[];
  ogImage: string | null;
  links: PageLink[];
  images: PageImage[];
  scripts: string[];
  stylesheets: string[];
  consoleMessages: ConsoleMessage[];
  pageErrors: PageError[];
  resources: PageResource[];
};
