import type {
  ExtractionResult,
  ExtractionSource,
  HistoryEntry,
  OutputFormat,
} from "./types";

export function createHistoryEntry(
  data: ExtractionResult,
  source: ExtractionSource,
  format: OutputFormat,
): HistoryEntry {
  const now = Date.now();
  return {
    id: `hist_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    title: data.title || "Untitled",
    url: data.url || "",
    siteName: data.siteName || "",
    source,
    format,
    content: data.content,
    textContent: data.textContent,
    analysis: data.analysis,
    metadata: data.metadata,
  };
}

export function insertHistoryEntry(
  history: HistoryEntry[],
  entry: HistoryEntry,
  maxItems: number = 50,
): HistoryEntry[] {
  const next = [entry, ...history];
  return next.slice(0, Math.max(1, maxItems));
}

export function removeHistoryEntry(
  history: HistoryEntry[],
  id: string,
): HistoryEntry[] {
  return history.filter((item) => item.id !== id);
}
