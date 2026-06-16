import type { OutputFormat } from "./types";

export function getReadingStats(text: string): { words: number; time: number } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, time: 0 };

  const words = trimmed.split(/\s+/).length;
  return { words, time: Math.max(1, Math.ceil(words / 200)) };
}

export function buildDownloadFilename(
  title: string,
  format: OutputFormat,
): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${base || "smart_extract"}.${format.toLowerCase()}`;
}

export type ManualCleanAction = "links" | "images" | "blankLines";

export function cleanExtractedText(
  content: string,
  action: ManualCleanAction,
): string {
  if (action === "links") {
    return content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
  }
  if (action === "images") {
    return content.replace(/!\[[^\]]*\]\([^)]+\)\n?/g, "").trim();
  }
  return content.replace(/\n{3,}/g, "\n\n").trim();
}
