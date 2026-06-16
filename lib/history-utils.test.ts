import { describe, expect, it } from "bun:test";
import type { ExtractionResult } from "./types";
import {
  createHistoryEntry,
  insertHistoryEntry,
  removeHistoryEntry,
} from "./history-utils";

const baseExtraction: ExtractionResult = {
  title: "Test Title",
  byline: "Author",
  dir: "ltr",
  content: "# Hello",
  textContent: "Hello",
  length: 5,
  excerpt: "Hello excerpt",
  siteName: "example.com",
  url: "https://example.com/article",
};

describe("history-utils", () => {
  it("creates a stable history entry from extraction data", () => {
    const entry = createHistoryEntry(baseExtraction, "full", "MD");

    expect(entry.id).toStartWith("hist_");
    expect(entry.source).toBe("full");
    expect(entry.format).toBe("MD");
    expect(entry.url).toBe(baseExtraction.url);
    expect(entry.content).toBe(baseExtraction.content);
    expect(entry.createdAt).toBeGreaterThan(0);
  });

  it("preserves analysis and metadata in history entries", () => {
    const extraction: ExtractionResult = {
      ...baseExtraction,
      metadata: {
        title: "Test Title",
        description: "Description",
        author: "Author",
        publishedTime: "2026-04-29",
        canonicalUrl: "https://example.com/article",
        siteName: "Example",
      },
      analysis: {
        score: 42,
        level: "poor",
        issues: ["Konten terlalu pendek"],
        recommendations: ["Coba mode Raw"],
        linkCount: 1,
        imageCount: 2,
        duplicateBlockCount: 3,
        noiseCount: 4,
      },
    };

    const entry = createHistoryEntry(extraction, "full", "MD");

    expect(entry.analysis).toEqual(extraction.analysis);
    expect(entry.metadata).toEqual(extraction.metadata);
  });

  it("keeps newest first and enforces max history size", () => {
    const existing = Array.from({ length: 3 }).map((_, idx) =>
      createHistoryEntry(
        {
          ...baseExtraction,
          title: `Title ${idx}`,
          url: `https://example.com/${idx}`,
        },
        "full",
        "MD",
      ),
    );

    const newest = createHistoryEntry(
      {
        ...baseExtraction,
        title: "Latest",
        url: "https://example.com/latest",
      },
      "selection",
      "TXT",
    );

    const next = insertHistoryEntry(existing, newest, 3);

    expect(next).toHaveLength(3);
    expect(next[0]?.title).toBe("Latest");
  });

  it("removes entry by id", () => {
    const first = createHistoryEntry(baseExtraction, "full", "MD");
    const second = createHistoryEntry(
      { ...baseExtraction, title: "Second", url: "https://example.com/2" },
      "picker",
      "MD",
    );

    const next = removeHistoryEntry([first, second], first.id);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe(second.id);
  });
});
