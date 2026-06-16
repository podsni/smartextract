import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { extractPageContent } from "./extractor";

describe("extractPageContent", () => {
  it("extracts readable fallback content when Readability cannot parse", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head><title>Docs Page</title></head><body><main><h1>Docs Page</h1><p>Important setup instructions for users.</p></main></body></html>`,
      {
        url: "https://example.com/docs",
      },
    );

    const result = await extractPageContent(
      dom.window.document,
      "https://example.com/docs",
    );

    expect(result?.title).toContain("Docs Page");
    expect(result?.content).toContain("Important setup instructions");
  });

  it("removes noisy content in clean mode", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head><title>Clean</title></head><body><main><p>Keep this content.</p><div class="newsletter">Subscribe now</div></main></body></html>`,
      { url: "https://example.com/clean" },
    );

    const result = await extractPageContent(
      dom.window.document,
      "https://example.com/clean",
      false,
      undefined,
      { mode: "clean" },
    );

    expect(result?.content).toContain("Keep this content");
    expect(result?.content).not.toContain("Subscribe now");
  });

  it("can remove images and links from markdown output", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head><title>Options</title></head><body><main><p><a href="/docs">Docs</a></p><img src="/x.png" alt="X"></main></body></html>`,
      { url: "https://example.com/options" },
    );

    const result = await extractPageContent(
      dom.window.document,
      "https://example.com/options",
      false,
      undefined,
      { mode: "clean", includeImages: false, includeLinks: false },
    );

    expect(result?.content).toContain("Docs");
    expect(result?.content).not.toContain("](https://example.com/docs)");
    expect(result?.content).not.toContain("![X]");
  });

  it("attaches quality analysis to extraction results", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head><title>Analysis</title></head><body><main><p>Subscribe now cookie advertisement</p></main></body></html>`,
      { url: "https://example.com/analysis" },
    );

    const result = await extractPageContent(
      dom.window.document,
      "https://example.com/analysis",
      false,
      undefined,
      { mode: "raw" },
    );

    expect(result?.analysis?.level).toBe("poor");
    expect(result?.analysis?.issues).toContain("Konten masih mengandung noise");
  });
});
