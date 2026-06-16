import { describe, expect, it } from "bun:test";
import { analyzeExtractionQuality } from "./extraction-analysis";

describe("analyzeExtractionQuality", () => {
  it("scores rich article content as good", () => {
    const text = Array.from({ length: 260 }, (_, index) => `word${index}`).join(
      " ",
    );

    const analysis = analyzeExtractionQuality({
      content: `# Article\n\n${text}`,
      textContent: text,
      metadata: {
        title: "Good Article",
        description: "Useful description",
        author: "Author",
        publishedTime: "2026-04-29",
        canonicalUrl: "https://example.com/article",
        siteName: "Example",
      },
    });

    expect(analysis.level).toBe("good");
    expect(analysis.score).toBeGreaterThanOrEqual(80);
  });

  it("detects short and noisy content", () => {
    const analysis = analyzeExtractionQuality({
      content: "Subscribe now cookie advertisement",
      textContent: "Subscribe now cookie advertisement",
    });

    expect(analysis.level).toBe("poor");
    expect(analysis.issues).toContain("Konten terlalu pendek");
    expect(analysis.issues).toContain("Konten masih mengandung noise");
    expect(analysis.recommendations).toContain("Coba mode Clean Page");
  });

  it("detects link-heavy extraction", () => {
    const content = Array.from(
      { length: 30 },
      (_, index) => `[Link ${index}](https://example.com/${index})`,
    ).join("\n");

    const analysis = analyzeExtractionQuality({
      content,
      textContent: "Link heavy content with useful words ".repeat(20),
    });

    expect(analysis.issues).toContain("Terlalu banyak link");
    expect(analysis.recommendations).toContain("Matikan Pertahankan link");
  });
});
