export function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function normalizeUrl(url: string, baseUrl: string): string {
  try {
    const resolved = new URL(url, baseUrl).href;
    const parsed = new URL(resolved);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

export function isSameOrigin(url: string, baseOrigin: string): boolean {
  return getOrigin(url) === baseOrigin;
}

const skippedExtensions = new Set([
  "pdf",
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "exe",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "mp3",
  "mp4",
  "avi",
  "mov",
  "wmv",
  "flv",
  "webm",
  "ogg",
  "ogv",
  "wav",
  "flac",
  "aac",
  "m4a",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "svg",
  "webp",
  "ico",
  "bmp",
  "tiff",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "css",
  "js",
  "mjs",
  "json",
  "xml",
  "rss",
  "atom",
]);

export function isLikelyDownload(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    return ext ? skippedExtensions.has(ext) : false;
  } catch {
    return false;
  }
}
