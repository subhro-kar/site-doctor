import { existsSync, readdirSync, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mdx"];

export function resolveSourceFile(
  projectDir: string | undefined,
  urlPath: string,
): string | undefined {
  if (!projectDir) return undefined;

  const cleanPath = urlPath.replace(/\/$/, "").replace(/^\//, "");
  const segments = cleanPath === "" ? [] : cleanPath.split("/");

  const roots = [projectDir, ...findMonorepoAppDirs(projectDir)];
  const candidates: { path: string; root: string; priority: number }[] = [];

  for (const root of roots) {
    for (const candidate of buildAppRouterCandidates(root, segments)) {
      if (existsSync(candidate)) {
        candidates.push({ path: candidate, root, priority: appDirPriority(root) });
      }
    }
    for (const candidate of buildPagesRouterCandidates(root, segments)) {
      if (existsSync(candidate)) {
        candidates.push({ path: candidate, root, priority: appDirPriority(root) });
      }
    }
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => b.priority - a.priority);
  return normalizePath(candidates[0].path);
}

function appDirPriority(root: string): number {
  const name = root.split(sep).pop()?.toLowerCase() ?? "";
  const preferred = ["web", "site", "app", "website", "frontend", "client"];
  const index = preferred.indexOf(name);
  return index === -1 ? 0 : preferred.length - index;
}

function findMonorepoAppDirs(projectDir: string): string[] {
  const dirs: string[] = [];
  for (const parent of ["apps", "packages", "src"]) {
    const parentPath = join(projectDir, parent);
    if (!existsSync(parentPath)) continue;
    try {
      for (const entry of readdirSync(parentPath)) {
        const entryPath = join(parentPath, entry);
        if (statSync(entryPath).isDirectory()) {
          dirs.push(entryPath);
        }
      }
    } catch {
      // ignore permission errors
    }
  }
  return dirs;
}

function buildAppRouterCandidates(projectDir: string, segments: string[]): string[] {
  const candidates: string[] = [];

  for (const ext of EXTENSIONS) {
    if (segments.length === 0) {
      candidates.push(join(projectDir, "app", `page${ext}`));
      candidates.push(join(projectDir, "src", "app", `page${ext}`));
    } else {
      const routePath = join(projectDir, "app", ...segments, `page${ext}`);
      const srcRoutePath = join(projectDir, "src", "app", ...segments, `page${ext}`);
      const layoutPath = join(projectDir, "app", ...segments, `layout${ext}`);
      const srcLayoutPath = join(projectDir, "src", "app", ...segments, `layout${ext}`);
      candidates.push(routePath, srcRoutePath, layoutPath, srcLayoutPath);
    }

    // Dynamic route fallback: [...slug] / [[...slug]]
    if (segments.length > 0) {
      const dynamicSegments = buildDynamicSegments(segments);
      for (const dyn of dynamicSegments) {
        candidates.push(join(projectDir, "app", ...dyn, `page${ext}`));
        candidates.push(join(projectDir, "src", "app", ...dyn, `page${ext}`));
      }
    }
  }

  return candidates;
}

function buildPagesRouterCandidates(projectDir: string, segments: string[]): string[] {
  const candidates: string[] = [];

  for (const ext of EXTENSIONS) {
    if (segments.length === 0) {
      candidates.push(join(projectDir, "pages", `index${ext}`));
      candidates.push(join(projectDir, "src", "pages", `index${ext}`));
    } else {
      candidates.push(join(projectDir, "pages", ...segments, `index${ext}`));
      candidates.push(join(projectDir, "src", "pages", ...segments, `index${ext}`));
      candidates.push(join(projectDir, "pages", `${segments.join("/")}${ext}`));
      candidates.push(join(projectDir, "src", "pages", `${segments.join("/")}${ext}`));
    }

    if (segments.length > 0) {
      const dynamicSegments = buildDynamicSegments(segments);
      for (const dyn of dynamicSegments) {
        candidates.push(join(projectDir, "pages", ...dyn, `index${ext}`));
        candidates.push(join(projectDir, "src", "pages", ...dyn, `index${ext}`));
      }
    }
  }

  return candidates;
}

function buildDynamicSegments(segments: string[]): string[][] {
  const results: string[][] = [];

  // Replace trailing segments with [...slug]
  for (let i = segments.length; i >= 0; i--) {
    const prefix = segments.slice(0, i);
    const rest = segments.slice(i);
    if (rest.length > 0) {
      results.push([...prefix, `[...${rest.join("-")}]`]);
    }
    if (i === segments.length && rest.length === 0) {
      results.push([...prefix, "[...slug]"]);
    }
  }

  return results;
}

function normalizePath(path: string): string {
  return normalize(path).split(sep).join("/");
}

export function createEditorLink(filePath: string, editor: string = "vscode"): string {
  switch (editor.toLowerCase()) {
    case "vscode":
    case "code":
      return `vscode://file/${filePath}`;
    case "cursor":
      return `cursor://file/${filePath}`;
    case "webstorm":
    case "idea":
      return `jetbrains://webstorm/open?file=${filePath}`;
    default:
      return `vscode://file/${filePath}`;
  }
}
