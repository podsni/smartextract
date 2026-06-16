import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { extractPageMetadata } from "./metadata";

describe("extractPageMetadata", () => {
  it("reads common meta tags and canonical URL", () => {
    const dom = new JSDOM(
      `<!doctype html><html><head>
        <title>Fallback Title</title>
        <meta property="og:title" content="OG Title">
        <meta name="description" content="Meta description">
        <meta name="author" content="Jane Doe">
        <meta property="article:published_time" content="2026-04-29">
        <link rel="canonical" href="/canonical">
      </head><body></body></html>`,
      { url: "https://example.com/post?x=1" },
    );

    expect(
      extractPageMetadata(dom.window.document, "https://example.com/post?x=1"),
    ).toEqual({
      title: "OG Title",
      description: "Meta description",
      author: "Jane Doe",
      publishedTime: "2026-04-29",
      canonicalUrl: "https://example.com/canonical",
      siteName: "example.com",
    });
  });
});
