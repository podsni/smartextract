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
});
